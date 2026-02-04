use axum::http::HeaderMap;

/// The query parameter key used to pass the access token
pub const ACCESS_TOKEN_QUERY_KEY: &str = "ACCESS_TOKEN";

/// The default token suffix when no token is provided
pub const NO_TOKEN_SUFFIX: &str = "none";

/// Extracts the API token from either:
/// 1. Authorization header using "Bearer <token>" format
/// 2. Query parameter using "ACCESS_TOKEN=<token>" key
///
/// Returns the full token if found, None otherwise.
pub fn extract_token_from_headers_and_uri(
    headers: &HeaderMap,
    uri: &axum::http::Uri,
) -> Option<String> {
    // First, try to get from Authorization header
    // RFC 7235: auth scheme is case-insensitive
    if let Some(auth_header) = headers.get(axum::http::header::AUTHORIZATION) {
        if let Ok(auth_str) = auth_header.to_str() {
            if let Some((scheme, token)) = auth_str.split_once(' ') {
                if scheme.eq_ignore_ascii_case("bearer") {
                    let token = token.trim();
                    if !token.is_empty() {
                        return Some(token.to_string());
                    }
                }
            }
        }
    }

    // If not in header, try to get from query parameters
    if let Some(query) = uri.query() {
        for pair in query.split('&') {
            if let Some((key, value)) = pair.split_once('=') {
                if key == ACCESS_TOKEN_QUERY_KEY {
                    let value = value.trim();
                    if !value.is_empty() {
                        return Some(value.to_string());
                    }
                }
            }
        }
    }

    None
}

/// Extracts the last 4 characters of the token to use as a suffix for metrics.
/// Returns "none" if no token is provided.
pub fn get_token_suffix(token: Option<&str>) -> String {
    match token {
        Some(t) if !t.is_empty() => {
            // Use char iterator to safely handle UTF-8
            let chars: Vec<char> = t.chars().collect();
            let len = chars.len();
            if len >= 4 {
                chars
                    .get(len - 4..)
                    .map(|s| s.iter().collect())
                    .unwrap_or_else(|| NO_TOKEN_SUFFIX.to_string())
            } else {
                chars.iter().collect() // Token shorter than 4 chars, use the whole thing
            }
        }
        _ => NO_TOKEN_SUFFIX.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::{HeaderMap, HeaderValue, Uri};

    #[test]
    fn test_extract_token_from_bearer_header() {
        let mut headers = HeaderMap::new();
        headers.insert(
            axum::http::header::AUTHORIZATION,
            HeaderValue::from_static("Bearer my_secret_token_1234"),
        );
        let uri: Uri = "/api/test".parse().unwrap();

        let token = extract_token_from_headers_and_uri(&headers, &uri);
        assert_eq!(token, Some("my_secret_token_1234".to_string()));
    }

    #[test]
    fn test_extract_token_from_bearer_header_case_insensitive() {
        for scheme in &["bearer", "BEARER", "Bearer", "bEaReR"] {
            let mut headers = HeaderMap::new();
            let value = format!("{scheme} my_secret_token_1234");
            headers.insert(
                axum::http::header::AUTHORIZATION,
                HeaderValue::from_str(&value).unwrap(),
            );
            let uri: Uri = "/api/test".parse().unwrap();

            let token = extract_token_from_headers_and_uri(&headers, &uri);
            assert_eq!(
                token,
                Some("my_secret_token_1234".to_string()),
                "Failed for scheme: {scheme}",
            );
        }
    }

    #[test]
    fn test_extract_token_from_query_param() {
        let headers = HeaderMap::new();
        let uri: Uri = "/api/test?ACCESS_TOKEN=query_token_5678".parse().unwrap();

        let token = extract_token_from_headers_and_uri(&headers, &uri);
        assert_eq!(token, Some("query_token_5678".to_string()));
    }

    #[test]
    fn test_bearer_takes_precedence_over_query() {
        let mut headers = HeaderMap::new();
        headers.insert(
            axum::http::header::AUTHORIZATION,
            HeaderValue::from_static("Bearer header_token"),
        );
        let uri: Uri = "/api/test?ACCESS_TOKEN=query_token".parse().unwrap();

        let token = extract_token_from_headers_and_uri(&headers, &uri);
        assert_eq!(token, Some("header_token".to_string()));
    }

    #[test]
    fn test_no_token() {
        let headers = HeaderMap::new();
        let uri: Uri = "/api/test".parse().unwrap();

        let token = extract_token_from_headers_and_uri(&headers, &uri);
        assert_eq!(token, None);
    }

    #[test]
    fn test_get_token_suffix() {
        assert_eq!(get_token_suffix(Some("my_secret_token_1234")), "1234");
        assert_eq!(get_token_suffix(Some("abc")), "abc");
        assert_eq!(get_token_suffix(Some("")), "none");
        assert_eq!(get_token_suffix(None), "none");
    }
}
