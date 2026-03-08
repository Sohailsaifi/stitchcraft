use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

impl Point {
    pub fn new(x: f64, y: f64) -> Self {
        Self { x, y }
    }

    pub fn distance_to(&self, other: &Point) -> f64 {
        let dx = other.x - self.x;
        let dy = other.y - self.y;
        (dx * dx + dy * dy).sqrt()
    }

    pub fn lerp(&self, other: &Point, t: f64) -> Point {
        Point {
            x: self.x + (other.x - self.x) * t,
            y: self.y + (other.y - self.y) * t,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum StitchType {
    Normal,
    Jump,
    Trim,
    Stop,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Stitch {
    pub x: f64,
    pub y: f64,
    pub stitch_type: StitchType,
}

impl Stitch {
    pub fn normal(x: f64, y: f64) -> Self {
        Self { x, y, stitch_type: StitchType::Normal }
    }

    pub fn jump(x: f64, y: f64) -> Self {
        Self { x, y, stitch_type: StitchType::Jump }
    }

    pub fn trim(x: f64, y: f64) -> Self {
        Self { x, y, stitch_type: StitchType::Trim }
    }
}
