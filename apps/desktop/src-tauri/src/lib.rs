#![deny(clippy::unwrap_used, clippy::expect_used)]

pub mod db;
pub mod error;
pub mod models;
pub mod server;
pub mod session;

pub use error::AppError;

