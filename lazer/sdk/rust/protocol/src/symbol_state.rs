use {
    serde::{Deserialize, Serialize},
    std::fmt::Display,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SymbolState {
    Stable,
    ComingSoon,
}

impl Display for SymbolState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SymbolState::Stable => write!(f, "stable"),
            SymbolState::ComingSoon => write!(f, "coming_soon"),
        }
    }
}
