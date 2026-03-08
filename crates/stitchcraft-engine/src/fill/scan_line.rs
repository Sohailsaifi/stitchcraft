use crate::types::{Point, Stitch};

/// Generate tatami fill stitches for a polygon using a scan-line algorithm.
///
/// `polygon` - Closed polygon vertices (first and last point should be the same or will be closed)
/// `angle` - Fill angle in degrees
/// `row_spacing` - Distance between fill rows in mm
/// `max_stitch_length` - Maximum stitch length in mm
/// `stagger` - Row stagger factor (0.0-1.0), typically 0.25 or 0.33
pub fn generate_fill_stitches(
    polygon: &[Point],
    angle: f64,
    row_spacing: f64,
    max_stitch_length: f64,
    stagger: f64,
) -> Vec<Stitch> {
    if polygon.len() < 3 {
        return vec![];
    }

    let angle_rad = angle.to_radians();
    let cos_a = angle_rad.cos();
    let sin_a = angle_rad.sin();

    // Rotate polygon so fill direction is horizontal
    let rotated: Vec<Point> = polygon
        .iter()
        .map(|p| Point::new(p.x * cos_a + p.y * sin_a, -p.x * sin_a + p.y * cos_a))
        .collect();

    // Find bounding box of rotated polygon
    let min_y = rotated.iter().map(|p| p.y).fold(f64::INFINITY, f64::min);
    let max_y = rotated.iter().map(|p| p.y).fold(f64::NEG_INFINITY, f64::max);

    let mut stitches = Vec::new();
    let mut row_index = 0;
    let mut y = min_y + row_spacing * 0.5;

    while y < max_y {
        // Find intersections of scan line with polygon edges
        let mut intersections = scan_line_intersections(&rotated, y);
        intersections.sort_by(|a, b| a.partial_cmp(b).unwrap());

        // Process intersection pairs
        let offset = stagger * max_stitch_length * (row_index as f64 % (1.0 / stagger).ceil());
        let reverse = row_index % 2 == 1;

        let mut i = 0;
        while i + 1 < intersections.len() {
            let x_start = intersections[i];
            let x_end = intersections[i + 1];

            let segment_stitches =
                fill_segment(x_start, x_end, y, max_stitch_length, offset, reverse);

            // Rotate stitches back to original orientation
            for s in segment_stitches {
                let rx = s.x * cos_a - s.y * sin_a;
                let ry = s.x * sin_a + s.y * cos_a;
                stitches.push(Stitch::normal(rx, ry));
            }

            i += 2;
        }

        y += row_spacing;
        row_index += 1;
    }

    stitches
}

fn scan_line_intersections(polygon: &[Point], y: f64) -> Vec<f64> {
    let mut intersections = Vec::new();
    let n = polygon.len();

    for i in 0..n {
        let j = (i + 1) % n;
        let p1 = &polygon[i];
        let p2 = &polygon[j];

        if (p1.y <= y && p2.y > y) || (p2.y <= y && p1.y > y) {
            let t = (y - p1.y) / (p2.y - p1.y);
            let x = p1.x + t * (p2.x - p1.x);
            intersections.push(x);
        }
    }

    intersections
}

fn fill_segment(
    x_start: f64,
    x_end: f64,
    y: f64,
    max_stitch_length: f64,
    offset: f64,
    reverse: bool,
) -> Vec<Stitch> {
    let mut stitches = Vec::new();
    let seg_len = x_end - x_start;

    if seg_len <= 0.0 {
        return stitches;
    }

    let num_stitches = (seg_len / max_stitch_length).ceil() as usize;
    let actual_length = seg_len / num_stitches as f64;

    if reverse {
        stitches.push(Stitch::normal(x_end, y));
        for i in 1..=num_stitches {
            let x = x_end - actual_length * i as f64;
            stitches.push(Stitch::normal(x.max(x_start), y));
        }
    } else {
        stitches.push(Stitch::normal(x_start, y));
        for i in 1..=num_stitches {
            let x = x_start + actual_length * i as f64;
            stitches.push(Stitch::normal(x.min(x_end), y));
        }
    }

    stitches
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fill_square() {
        let polygon = vec![
            Point::new(0.0, 0.0),
            Point::new(10.0, 0.0),
            Point::new(10.0, 10.0),
            Point::new(0.0, 10.0),
        ];

        let stitches = generate_fill_stitches(&polygon, 0.0, 0.5, 7.0, 0.25);
        assert!(!stitches.is_empty());

        // All stitches should be within bounds (with small tolerance)
        for s in &stitches {
            assert!(s.x >= -0.1 && s.x <= 10.1, "x={} out of bounds", s.x);
            assert!(s.y >= -0.1 && s.y <= 10.1, "y={} out of bounds", s.y);
        }
    }
}
