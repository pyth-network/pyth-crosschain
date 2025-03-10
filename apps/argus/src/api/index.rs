use axum::{response::IntoResponse, Json};

/// This is the index page for the REST service. It lists all the available endpoints.
///
/// TODO: Dynamically generate this list if possible.
pub async fn index() -> impl IntoResponse {
    Json::<[&str; 0]>([])
}
