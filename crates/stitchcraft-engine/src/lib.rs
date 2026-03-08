pub mod types;
pub mod running;
pub mod satin;
pub mod fill;

use wasm_bindgen::prelude::*;
use types::{Point, Stitch};

#[wasm_bindgen]
pub fn generate_run_stitches_wasm(
    points_json: &str,
    stitch_length: f64,
    is_triple: bool,
) -> String {
    let points: Vec<Point> = serde_json::from_str(points_json).unwrap_or_default();
    let stitches = running::generate_running_stitches(&points, stitch_length, is_triple);
    serde_json::to_string(&stitches).unwrap_or_default()
}

#[wasm_bindgen]
pub fn generate_satin_stitches_wasm(
    left_json: &str,
    right_json: &str,
    density: f64,
    pull_compensation: f64,
) -> String {
    let left: Vec<Point> = serde_json::from_str(left_json).unwrap_or_default();
    let right: Vec<Point> = serde_json::from_str(right_json).unwrap_or_default();
    let stitches = satin::generate_satin_stitches(&left, &right, density, pull_compensation);
    serde_json::to_string(&stitches).unwrap_or_default()
}

#[wasm_bindgen]
pub fn generate_fill_stitches_wasm(
    polygon_json: &str,
    angle: f64,
    row_spacing: f64,
    max_stitch_length: f64,
    stagger: f64,
) -> String {
    let polygon: Vec<Point> = serde_json::from_str(polygon_json).unwrap_or_default();
    let stitches = fill::generate_fill_stitches(&polygon, angle, row_spacing, max_stitch_length, stagger);
    serde_json::to_string(&stitches).unwrap_or_default()
}
