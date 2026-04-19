use crate::error::AppError;

fn is_allowed(url: &str) -> bool {
    if url.is_empty() || url.len() > 2048 {
        return false;
    }
    // Reject anything that could be interpreted as a CLI flag by `open` / `xdg-open`.
    if url.starts_with('-') {
        return false;
    }
    // Disallow control characters and whitespace — keeps the argument a single URL.
    if url.chars().any(|c| c.is_control() || c == ' ' || c == '\t') {
        return false;
    }
    let lower = url.to_ascii_lowercase();
    const ALLOWED: &[&str] = &["http://", "https://", "mailto:", "tel:"];
    ALLOWED.iter().any(|s| lower.starts_with(s))
}

#[tauri::command]
pub fn open_external(url: String) -> Result<(), AppError> {
    if !is_allowed(&url) {
        return Err(AppError::AccessDenied);
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open").arg(&url).spawn()?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open").arg(&url).spawn()?;
    }
    #[cfg(target_os = "windows")]
    {
        // `""` is the window title placeholder for `start`; prevents quoted URL
        // being swallowed as the title.
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::is_allowed;

    #[test]
    fn allows_http_schemes() {
        assert!(is_allowed("http://example.com"));
        assert!(is_allowed("https://example.com/path?q=1"));
        assert!(is_allowed("HTTPS://example.com"));
    }

    #[test]
    fn allows_mailto_tel() {
        assert!(is_allowed("mailto:x@y.z"));
        assert!(is_allowed("tel:+123"));
    }

    #[test]
    fn rejects_flag_injection() {
        assert!(!is_allowed("-a /Applications/Calculator.app"));
        assert!(!is_allowed("--help"));
    }

    #[test]
    fn rejects_non_url_schemes() {
        assert!(!is_allowed("file:///etc/passwd"));
        assert!(!is_allowed("javascript:alert(1)"));
        assert!(!is_allowed("data:text/html,x"));
        assert!(!is_allowed("./foo.md"));
    }

    #[test]
    fn rejects_whitespace_and_control() {
        assert!(!is_allowed("https://example.com arg"));
        assert!(!is_allowed("https://example.com\nmalicious"));
        assert!(!is_allowed(""));
    }
}
