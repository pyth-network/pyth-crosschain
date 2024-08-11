use std::{error::Error, fmt::Display};

use url::ParseError;

#[derive(Debug)]
pub enum HermesClientError {
    /// The given URL is invalid.
    BadUrl(ParseError),

    /// The Errors may occur when processing a Request.
    RError(reqwest::Error),

    /// Server returned invalid response.
    NotJson(String),

    /// Invalid JSON response.
    Json(serde_json::Error),
}

impl Error for HermesClientError {}

impl Display for HermesClientError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match *self {
            HermesClientError::BadUrl(ref e) => write!(f, "bad url provided {}", e),
            HermesClientError::RError(ref e) => write!(f, "reqwest::Error occured {}", e),
            HermesClientError::NotJson(ref e) => {
                write!(f, "server returned invalid response {}", e)
            }
            HermesClientError::Json(ref e) => {
                write!(f, "server returned incoherent response {}", e)
            }
        }
    }
}

impl From<reqwest::Error> for HermesClientError {
    fn from(value: reqwest::Error) -> Self {
        Self::RError(value)
    }
}

impl From<ParseError> for HermesClientError {
    fn from(value: ParseError) -> Self {
        Self::BadUrl(value)
    }
}
