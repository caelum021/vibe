mod debounce;

use crate::constants::IGNORED;
use crate::link_index::{is_md, LinkGraph};
use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
pub struct FileChangedPayload {
    pub paths: Vec<String>,
    pub kind: String,
}

pub fn spawn_watcher(
    root: PathBuf,
    app: AppHandle,
    graph: Arc<LinkGraph>,
) -> Result<RecommendedWatcher, notify::Error> {
    let (tx, rx) = mpsc::channel::<notify::Result<Event>>();
    let mut watcher = RecommendedWatcher::new(tx, Config::default())?;
    watcher.watch(&root, RecursiveMode::Recursive)?;

    std::thread::spawn(move || {
        debounce::debounced_receiver(rx, Duration::from_millis(150), |events| {
            for event in &events {
                for p in &event.paths {
                    if is_ignored(p) {
                        continue;
                    }
                    apply_to_graph(&graph, &event.kind, p);
                }
            }
            let payload = build_payload(events);
            if !payload.paths.is_empty() {
                let _ = app.emit("file-changed", &payload);
            }
        });
    });

    Ok(watcher)
}

fn apply_to_graph(graph: &LinkGraph, kind: &EventKind, path: &Path) {
    if !is_md(path) {
        return;
    }
    match kind {
        EventKind::Remove(_) => graph.remove_file(path),
        _ => match std::fs::read_to_string(path) {
            Ok(source) => graph.reindex_file(path, &source),
            Err(_) => graph.remove_file(path),
        },
    }
}

fn build_payload(events: Vec<Event>) -> FileChangedPayload {
    let mut paths = Vec::new();
    let mut kind = "modify".to_string();
    for event in &events {
        let filtered = event
            .paths
            .iter()
            .filter(|p| !is_ignored(p))
            .map(|p| p.to_string_lossy().into_owned());
        paths.extend(filtered);
        kind = classify_kind(&event.kind);
    }
    paths.sort();
    paths.dedup();
    FileChangedPayload { paths, kind }
}

fn is_ignored(path: &std::path::Path) -> bool {
    let mut iter = path.components().peekable();
    while let Some(comp) = iter.next() {
        let name = comp.as_os_str().to_string_lossy();
        if name == ".git" {
            // Allow only the files that indicate git state changes.
            let rest: Vec<String> = iter.map(|c| c.as_os_str().to_string_lossy().into_owned()).collect();
            let joined = rest.join("/");
            if joined == "HEAD" || joined == "index" || joined.starts_with("refs/heads/") {
                return false;
            }
            return true;
        }
        if IGNORED.contains(&name.as_ref()) {
            return true;
        }
    }
    false
}

fn classify_kind(kind: &notify::EventKind) -> String {
    use notify::EventKind::*;
    match kind {
        Create(_) => "create",
        Modify(_) => "modify",
        Remove(_) => "remove",
        _ => "modify",
    }
    .to_string()
}
