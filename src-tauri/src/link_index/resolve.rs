use std::path::{Component, Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Resolution {
    Internal(PathBuf),
    External,
    Unresolved,
}

pub fn resolve_href(src: &Path, root: &Path, href: &str) -> Resolution {
    let trimmed = href.trim();
    if trimmed.is_empty() || trimmed.starts_with('#') {
        return Resolution::Unresolved;
    }

    if is_external(trimmed) {
        return Resolution::External;
    }

    let without_frag = trimmed.split_once('#').map(|(p, _)| p).unwrap_or(trimmed);
    let without_query = without_frag.split_once('?').map(|(p, _)| p).unwrap_or(without_frag);
    if without_query.is_empty() {
        return Resolution::Unresolved;
    }

    let decoded = percent_decode(without_query);

    let base = if decoded.starts_with('/') {
        root.to_path_buf()
    } else {
        match src.parent() {
            Some(p) => p.to_path_buf(),
            None => return Resolution::Unresolved,
        }
    };

    let rel = if let Some(stripped) = decoded.strip_prefix('/') {
        stripped.to_string()
    } else {
        decoded
    };

    let combined = base.join(&rel);
    let normalized = match normalize(&combined) {
        Some(p) => p,
        None => return Resolution::Unresolved,
    };

    if !normalized.starts_with(root) {
        return Resolution::Unresolved;
    }

    Resolution::Internal(normalized)
}

fn is_external(href: &str) -> bool {
    if href.starts_with("//") {
        return true;
    }
    let lower = href.to_ascii_lowercase();
    const SCHEMES: &[&str] = &[
        "http://", "https://", "mailto:", "tel:", "data:", "ftp://", "file://",
    ];
    SCHEMES.iter().any(|s| lower.starts_with(s))
}

fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(h), Some(l)) = (hex_val(bytes[i + 1]), hex_val(bytes[i + 2])) {
                out.push((h << 4) | l);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8(out).unwrap_or_else(|_| s.to_string())
}

fn hex_val(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(b - b'a' + 10),
        b'A'..=b'F' => Some(b - b'A' + 10),
        _ => None,
    }
}

fn normalize(path: &Path) -> Option<PathBuf> {
    let mut out = PathBuf::new();
    for comp in path.components() {
        match comp {
            Component::ParentDir => {
                if !out.pop() {
                    return None;
                }
            }
            Component::CurDir => {}
            Component::Prefix(p) => out.push(p.as_os_str()),
            Component::RootDir => out.push("/"),
            Component::Normal(n) => out.push(n),
        }
    }
    Some(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn root() -> PathBuf {
        PathBuf::from("/proj")
    }

    fn src() -> PathBuf {
        PathBuf::from("/proj/docs/a.md")
    }

    #[test]
    fn relative_sibling() {
        let r = resolve_href(&src(), &root(), "./b.md");
        assert_eq!(r, Resolution::Internal(PathBuf::from("/proj/docs/b.md")));
    }

    #[test]
    fn parent_dir() {
        let r = resolve_href(&src(), &root(), "../top.md");
        assert_eq!(r, Resolution::Internal(PathBuf::from("/proj/top.md")));
    }

    #[test]
    fn bare_relative() {
        let r = resolve_href(&src(), &root(), "b.md");
        assert_eq!(r, Resolution::Internal(PathBuf::from("/proj/docs/b.md")));
    }

    #[test]
    fn root_relative() {
        let r = resolve_href(&src(), &root(), "/foo/bar.md");
        assert_eq!(r, Resolution::Internal(PathBuf::from("/proj/foo/bar.md")));
    }

    #[test]
    fn http_external() {
        assert_eq!(resolve_href(&src(), &root(), "https://example.com"), Resolution::External);
        assert_eq!(resolve_href(&src(), &root(), "http://example.com"), Resolution::External);
    }

    #[test]
    fn mailto_external() {
        assert_eq!(resolve_href(&src(), &root(), "mailto:x@y.z"), Resolution::External);
    }

    #[test]
    fn tel_external() {
        assert_eq!(resolve_href(&src(), &root(), "tel:+123"), Resolution::External);
    }

    #[test]
    fn data_external() {
        assert_eq!(resolve_href(&src(), &root(), "data:image/png;base64,xxx"), Resolution::External);
    }

    #[test]
    fn protocol_relative_external() {
        assert_eq!(resolve_href(&src(), &root(), "//example.com/x"), Resolution::External);
    }

    #[test]
    fn anchor_only() {
        assert_eq!(resolve_href(&src(), &root(), "#heading"), Resolution::Unresolved);
    }

    #[test]
    fn with_fragment_stripped() {
        let r = resolve_href(&src(), &root(), "./b.md#section");
        assert_eq!(r, Resolution::Internal(PathBuf::from("/proj/docs/b.md")));
    }

    #[test]
    fn with_query_stripped() {
        let r = resolve_href(&src(), &root(), "./b.md?x=1");
        assert_eq!(r, Resolution::Internal(PathBuf::from("/proj/docs/b.md")));
    }

    #[test]
    fn escapes_root_unresolved() {
        let r = resolve_href(&src(), &root(), "../../../etc/passwd");
        assert_eq!(r, Resolution::Unresolved);
    }

    #[test]
    fn empty_unresolved() {
        assert_eq!(resolve_href(&src(), &root(), ""), Resolution::Unresolved);
    }

    #[test]
    fn non_md_extension_resolves() {
        let r = resolve_href(&src(), &root(), "./img.png");
        assert_eq!(r, Resolution::Internal(PathBuf::from("/proj/docs/img.png")));
    }

    #[test]
    fn percent_decoded_space() {
        let r = resolve_href(&src(), &root(), "./my%20file.md");
        assert_eq!(r, Resolution::Internal(PathBuf::from("/proj/docs/my file.md")));
    }

    #[test]
    fn case_insensitive_scheme() {
        assert_eq!(resolve_href(&src(), &root(), "HTTPS://example.com"), Resolution::External);
    }
}
