use std::sync::Arc;

#[derive(Debug, Clone)]
pub struct Configuration {
    pub base_path: String,
    pub user_agent: Option<String>,
    pub client: Arc<reqwest::Client>,
    pub basic_auth: Option<(String, Option<String>)>,
    pub oauth_access_token: Option<String>,
    pub api_key: Option<(String, String)>,
    pub bearer_access_token: Option<String>,
}

impl Configuration {
    pub fn new() -> Configuration {
        Configuration {
            base_path: "http://localhost".to_owned(),
            user_agent: Some("hermes-client/0.1.0".to_owned()),
            client: Arc::new(reqwest::Client::new()),
            basic_auth: None,
            oauth_access_token: None,
            api_key: None,
            bearer_access_token: None,
        }
    }
}
