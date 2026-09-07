#![deny(clippy::unwrap_used, clippy::expect_used)]

pub mod db;
pub mod error;

pub use error::AppError;
