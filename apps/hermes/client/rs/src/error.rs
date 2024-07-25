use std::{error::Error, fmt::Display};

use url::ParseError;

#[derive(Debug)]
pub enum PriceServiceError {
    /// The given URL is invalid.
    BadUrl(ParseError),

    /// The Errors may occur when processing a Request.
    RError(reqwest::Error),

    /// Server returned invalid response.
    NotJson(String),

    /// Invalid JSON response.
    Json(reqwest::Error),
}

impl Error for PriceServiceError {}

impl Display for PriceServiceError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match *self {
            PriceServiceError::BadUrl(ref e) => write!(f, "bad url provided {}", e),
            PriceServiceError::RError(ref e) => write!(f, "reqwest::Error occured {}", e),
            PriceServiceError::NotJson(ref e) => {
                write!(f, "server returned invalid response {}", e)
            }
            PriceServiceError::Json(ref e) => {
                write!(f, "server returned incoherent response {}", e)
            }
        }
    }
}

impl From<reqwest::Error> for PriceServiceError {
    fn from(value: reqwest::Error) -> Self {
        Self::RError(value)
    }
}

impl From<ParseError> for PriceServiceError {
    fn from(value: ParseError) -> Self {
        Self::BadUrl(value)
    }
}
