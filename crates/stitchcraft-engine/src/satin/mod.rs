use crate::types::{Point, Stitch};

/// Generate satin column stitches between two rails.
///
/// `rail_left` - Left rail points
/// `rail_right` - Right rail points
/// `density` - Stitches per mm along the column
/// `pull_compensation` - Extra width added to each side in mm
pub fn generate_satin_stitches(
    rail_left: &[Point],
    rail_right: &[Point],
    density: f64,
    pull_compensation: f64,
) -> Vec<Stitch> {
    if rail_left.len() < 2 || rail_right.len() < 2 {
        return vec![];
    }

    // Compute cumulative arc lengths for both rails
    let left_lengths = cumulative_lengths(rail_left);
    let right_lengths = cumulative_lengths(rail_right);

    let left_total = *left_lengths.last().unwrap();
    let right_total = *right_lengths.last().unwrap();
    let avg_length = (left_total + right_total) / 2.0;

    let num_rungs = (avg_length * density).ceil() as usize;
    if num_rungs < 2 {
        return vec![];
    }

    let mut stitches = Vec::new();

    for i in 0..num_rungs {
        let t = i as f64 / (num_rungs - 1) as f64;

        let left_pt = sample_at_t(rail_left, &left_lengths, t);
        let right_pt = sample_at_t(rail_right, &right_lengths, t);

        // Apply pull compensation
        let (left_comp, right_comp) = apply_compensation(left_pt, right_pt, pull_compensation);

        if i % 2 == 0 {
            stitches.push(Stitch::normal(left_comp.x, left_comp.y));
            stitches.push(Stitch::normal(right_comp.x, right_comp.y));
        } else {
            stitches.push(Stitch::normal(right_comp.x, right_comp.y));
            stitches.push(Stitch::normal(left_comp.x, left_comp.y));
        }
    }

    stitches
}

fn cumulative_lengths(points: &[Point]) -> Vec<f64> {
    let mut lengths = vec![0.0];
    for i in 1..points.len() {
        let d = points[i - 1].distance_to(&points[i]);
        lengths.push(lengths[i - 1] + d);
    }
    lengths
}

fn sample_at_t(points: &[Point], lengths: &[f64], t: f64) -> Point {
    let total = *lengths.last().unwrap();
    let target = t * total;

    for i in 1..lengths.len() {
        if lengths[i] >= target {
            let seg_start = lengths[i - 1];
            let seg_len = lengths[i] - seg_start;
            if seg_len == 0.0 {
                return points[i];
            }
            let local_t = (target - seg_start) / seg_len;
            return points[i - 1].lerp(&points[i], local_t);
        }
    }

    *points.last().unwrap()
}

fn apply_compensation(left: Point, right: Point, compensation: f64) -> (Point, Point) {
    if compensation == 0.0 {
        return (left, right);
    }

    let dx = right.x - left.x;
    let dy = right.y - left.y;
    let len = (dx * dx + dy * dy).sqrt();
    if len == 0.0 {
        return (left, right);
    }

    let ux = dx / len;
    let uy = dy / len;

    let new_left = Point::new(left.x - ux * compensation, left.y - uy * compensation);
    let new_right = Point::new(right.x + ux * compensation, right.y + uy * compensation);

    (new_left, new_right)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_satin() {
        let left = vec![Point::new(0.0, 0.0), Point::new(0.0, 10.0)];
        let right = vec![Point::new(3.0, 0.0), Point::new(3.0, 10.0)];

        let stitches = generate_satin_stitches(&left, &right, 4.0, 0.0);
        assert!(!stitches.is_empty());
    }
}
