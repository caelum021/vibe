use crate::error::AppError;
use crate::state::AppState;
use git2::{DiffOptions, Repository, Status, StatusOptions};
use serde::Serialize;
use std::cell::RefCell;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tauri::State;

const MAX_DIFF_FILE_SIZE: u64 = 1024 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
    pub is_repo: bool,
    pub branch: Option<String>,
    pub files: HashMap<String, String>, // relative path -> state string
}

fn classify(status: Status) -> Option<&'static str> {
    // Order matters: conflict > deleted > renamed > added > modified > untracked > clean
    if status.is_conflicted() {
        Some("modified")
    } else if status.is_wt_deleted() || status.is_index_deleted() {
        Some("deleted")
    } else if status.is_wt_renamed() || status.is_index_renamed() {
        Some("renamed")
    } else if status.is_index_new() {
        Some("added")
    } else if status.is_wt_new() {
        Some("untracked")
    } else if status.is_wt_modified()
        || status.is_index_modified()
        || status.is_wt_typechange()
        || status.is_index_typechange()
    {
        Some("modified")
    } else {
        // Clean, ignored, or anything else we don't care about.
        None
    }
}

fn open_repo(root: &Path) -> Option<Repository> {
    Repository::discover(root).ok().and_then(|repo| {
        // Only accept if the discovered workdir matches our root (no parent repos).
        let workdir = repo.workdir()?.canonicalize().ok()?;
        let canonical_root = root.canonicalize().ok()?;
        if workdir == canonical_root {
            Some(repo)
        } else {
            None
        }
    })
}

#[tauri::command]
pub fn git_status(state: State<AppState>) -> Result<GitStatus, AppError> {
    let root = state.get_root()?;
    let repo = match open_repo(&root) {
        Some(r) => r,
        None => {
            return Ok(GitStatus {
                is_repo: false,
                branch: None,
                files: HashMap::new(),
            })
        }
    };

    let branch = repo
        .head()
        .ok()
        .and_then(|h| h.shorthand().map(|s| s.to_string()));

    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .exclude_submodules(true);

    let statuses = repo.statuses(Some(&mut opts))?;
    let mut files = HashMap::with_capacity(statuses.len());
    for entry in statuses.iter() {
        if let (Some(path), Some(state)) = (entry.path(), classify(entry.status())) {
            files.insert(path.to_string(), state.to_string());
        }
    }

    Ok(GitStatus {
        is_repo: true,
        branch,
        files,
    })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffLine {
    pub kind: String, // "context" | "add" | "del"
    pub old_num: Option<u32>,
    pub new_num: Option<u32>,
    pub content: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Hunk {
    pub old_start: u32,
    pub old_lines: u32,
    pub new_start: u32,
    pub new_lines: u32,
    pub lines: Vec<DiffLine>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileDiff {
    pub path: String,
    pub is_binary: bool,
    pub hunks: Vec<Hunk>,
}

fn to_relative(root: &Path, abs: &str) -> Result<PathBuf, AppError> {
    let path = PathBuf::from(abs);
    let canonical = path.canonicalize().unwrap_or(path);
    let canonical_root = root.canonicalize().map_err(|_| AppError::AccessDenied)?;
    let rel = canonical
        .strip_prefix(&canonical_root)
        .map_err(|_| AppError::AccessDenied)?;
    Ok(rel.to_path_buf())
}

#[tauri::command]
pub fn git_diff(path: String, state: State<AppState>) -> Result<FileDiff, AppError> {
    let root = state.get_root()?;
    let repo = open_repo(&root).ok_or(AppError::AccessDenied)?;

    // Accept either absolute path (from frontend) or already-relative.
    let rel_path = if Path::new(&path).is_absolute() {
        to_relative(&root, &path)?
    } else {
        PathBuf::from(&path)
    };

    // Size guard on working tree file, if present.
    let abs = root.join(&rel_path);
    if let Ok(meta) = std::fs::metadata(&abs) {
        if meta.len() > MAX_DIFF_FILE_SIZE {
            return Err(AppError::FileTooLarge);
        }
    }

    let head_tree = repo.head().ok().and_then(|h| h.peel_to_tree().ok());

    let mut opts = DiffOptions::new();
    opts.pathspec(rel_path.to_string_lossy().as_ref())
        .context_lines(3)
        .include_untracked(true)
        .recurse_untracked_dirs(true)
        .show_untracked_content(true);

    let diff = match head_tree.as_ref() {
        Some(tree) => repo.diff_tree_to_workdir_with_index(Some(tree), Some(&mut opts))?,
        None => repo.diff_tree_to_workdir_with_index(None, Some(&mut opts))?,
    };

    let is_binary = RefCell::new(false);
    let hunks: RefCell<Vec<Hunk>> = RefCell::new(Vec::new());

    diff.foreach(
        &mut |_delta, _progress| true,
        Some(&mut |_delta, _binary| {
            *is_binary.borrow_mut() = true;
            true
        }),
        Some(&mut |_delta, hunk| {
            hunks.borrow_mut().push(Hunk {
                old_start: hunk.old_start(),
                old_lines: hunk.old_lines(),
                new_start: hunk.new_start(),
                new_lines: hunk.new_lines(),
                lines: Vec::new(),
            });
            true
        }),
        Some(&mut |_delta, _hunk, line| {
            let kind = match line.origin() {
                '+' => "add",
                '-' => "del",
                ' ' => "context",
                _ => return true, // skip file headers, binary markers, etc.
            };
            let content = std::str::from_utf8(line.content())
                .unwrap_or("")
                .trim_end_matches('\n')
                .to_string();
            let mut h = hunks.borrow_mut();
            if let Some(last) = h.last_mut() {
                last.lines.push(DiffLine {
                    kind: kind.to_string(),
                    old_num: line.old_lineno(),
                    new_num: line.new_lineno(),
                    content,
                });
            }
            true
        }),
    )?;

    Ok(FileDiff {
        path: rel_path.to_string_lossy().into_owned(),
        is_binary: is_binary.into_inner(),
        hunks: hunks.into_inner(),
    })
}
