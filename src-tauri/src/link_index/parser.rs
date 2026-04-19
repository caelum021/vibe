use pulldown_cmark::{Event, Options, Parser, Tag};
use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum LinkKind {
    Inline,
    Image,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedLink {
    pub href: String,
    pub line: u32,
    pub col: u32,
    pub snippet: String,
    pub kind: LinkKind,
}

const SNIPPET_MAX_CHARS: usize = 60;

pub fn parse_links(source: &str) -> Vec<ParsedLink> {
    let line_starts = compute_line_starts(source);
    let parser = Parser::new_ext(source, Options::all()).into_offset_iter();
    let mut out = Vec::new();

    for (event, range) in parser {
        let (href, kind) = match event {
            Event::Start(Tag::Link { dest_url, .. }) => (dest_url.to_string(), LinkKind::Inline),
            Event::Start(Tag::Image { dest_url, .. }) => (dest_url.to_string(), LinkKind::Image),
            _ => continue,
        };
        if href.is_empty() {
            continue;
        }
        let (line, col) = offset_to_line_col(source, &line_starts, range.start);
        let snippet = line_snippet(source, &line_starts, line);
        out.push(ParsedLink { href, line, col, snippet, kind });
    }

    out
}

fn compute_line_starts(source: &str) -> Vec<usize> {
    let mut v = vec![0usize];
    for (i, b) in source.bytes().enumerate() {
        if b == b'\n' {
            v.push(i + 1);
        }
    }
    v
}

fn offset_to_line_col(source: &str, line_starts: &[usize], byte_offset: usize) -> (u32, u32) {
    let idx = match line_starts.binary_search(&byte_offset) {
        Ok(i) => i,
        Err(i) => i.saturating_sub(1),
    };
    let line_start = line_starts[idx];
    let col = source
        .get(line_start..byte_offset)
        .map(|s| s.chars().count())
        .unwrap_or(0);
    ((idx + 1) as u32, (col + 1) as u32)
}

fn line_snippet(source: &str, line_starts: &[usize], line: u32) -> String {
    let idx = (line as usize).saturating_sub(1);
    let start = line_starts[idx];
    let end = line_starts
        .get(idx + 1)
        .copied()
        .unwrap_or(source.len());
    let raw = source
        .get(start..end)
        .unwrap_or("")
        .trim_end_matches('\n')
        .trim();
    raw.chars().take(SNIPPET_MAX_CHARS).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn basic_link() {
        let src = "See [docs](./docs.md) for details.\n";
        let links = parse_links(src);
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].href, "./docs.md");
        assert_eq!(links[0].kind, LinkKind::Inline);
        assert_eq!(links[0].line, 1);
        assert_eq!(links[0].col, 5);
        assert!(links[0].snippet.contains("See [docs]"));
    }

    #[test]
    fn image_link() {
        let src = "![alt](./img.png)\n";
        let links = parse_links(src);
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].href, "./img.png");
        assert_eq!(links[0].kind, LinkKind::Image);
    }

    #[test]
    fn fenced_code_excluded() {
        let src = "```\n[x](./y.md)\n```\n";
        assert!(parse_links(src).is_empty());
    }

    #[test]
    fn indented_code_excluded() {
        let src = "paragraph\n\n    [x](./y.md)\n";
        assert!(parse_links(src).is_empty());
    }

    #[test]
    fn inline_code_excluded() {
        let src = "text `[x](./y.md)` text\n";
        assert!(parse_links(src).is_empty());
    }

    #[test]
    fn autolink_captured() {
        let src = "See <https://example.com>.\n";
        let links = parse_links(src);
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].href, "https://example.com");
    }

    #[test]
    fn multiline_source_line_numbers() {
        let src = "first line\n\n## heading\n\nGo to [target](./t.md).\n";
        let links = parse_links(src);
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].line, 5);
    }

    #[test]
    fn multiple_links_in_line() {
        let src = "[a](./a.md) and [b](./b.md)\n";
        let links = parse_links(src);
        assert_eq!(links.len(), 2);
        assert_eq!(links[0].href, "./a.md");
        assert_eq!(links[1].href, "./b.md");
        assert_eq!(links[0].line, 1);
        assert_eq!(links[1].line, 1);
        assert!(links[0].col < links[1].col);
    }

    #[test]
    fn empty_href_skipped() {
        let src = "[label]()\n";
        assert!(parse_links(src).is_empty());
    }

    #[test]
    fn snippet_truncated() {
        let long_prefix = "x".repeat(100);
        let src = format!("{} [l](./l.md)\n", long_prefix);
        let links = parse_links(&src);
        assert_eq!(links.len(), 1);
        assert!(links[0].snippet.chars().count() <= SNIPPET_MAX_CHARS);
    }

    #[test]
    fn unicode_col_counts_chars() {
        let src = "한글 [링크](./k.md)\n";
        let links = parse_links(src);
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].col, 4);
    }
}
