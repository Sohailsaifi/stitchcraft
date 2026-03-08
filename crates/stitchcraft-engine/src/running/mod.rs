use crate::types::{Point, Stitch};

/// Generate running stitches along a polyline path.
///
/// `points` - The control points defining the path
/// `stitch_length` - Target stitch length in mm
/// `is_triple` - If true, generates triple (bean) stitch
pub fn generate_running_stitches(
    points: &[Point],
    stitch_length: f64,
    is_triple: bool,
) -> Vec<Stitch> {
    if points.len() < 2 {
        return vec![];
    }

    let mut stitches = vec![Stitch::normal(points[0].x, points[0].y)];

    for i in 1..points.len() {
        let prev = &points[i - 1];
        let curr = &points[i];
        let seg_len = prev.distance_to(curr);

        if seg_len == 0.0 {
            continue;
        }

        let ux = (curr.x - prev.x) / seg_len;
        let uy = (curr.y - prev.y) / seg_len;

        let num_stitches = (seg_len / stitch_length).ceil() as usize;
        let actual_length = seg_len / num_stitches as f64;

        for j in 1..=num_stitches {
            let d = actual_length * j as f64;
            let x = prev.x + ux * d;
            let y = prev.y + uy * d;
            stitches.push(Stitch::normal(x, y));
        }
    }

    if is_triple {
        return make_triple_stitch(&stitches);
    }

    stitches
}

/// Convert single running stitch into triple (bean) stitch.
/// Each segment is stitched forward, back, forward.
fn make_triple_stitch(stitches: &[Stitch]) -> Vec<Stitch> {
    if stitches.len() < 2 {
        return stitches.to_vec();
    }

    let mut result = vec![stitches[0].clone()];

    for i in 1..stitches.len() {
        let curr = &stitches[i];
        let prev = &stitches[i - 1];

        // Forward
        result.push(curr.clone());
        // Back
        result.push(Stitch::normal(prev.x, prev.y));
        // Forward again
        result.push(curr.clone());
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_running_stitch() {
        let points = vec![Point::new(0.0, 0.0), Point::new(10.0, 0.0)];
        let stitches = generate_running_stitches(&points, 2.5, false);

        assert!(stitches.len() > 2);
        // First stitch at origin
        assert_eq!(stitches[0].x, 0.0);
        assert_eq!(stitches[0].y, 0.0);
        // Last stitch at endpoint
        let last = stitches.last().unwrap();
        assert!((last.x - 10.0).abs() < 0.001);
    }

    #[test]
    fn test_triple_stitch() {
        let points = vec![Point::new(0.0, 0.0), Point::new(5.0, 0.0)];
        let single = generate_running_stitches(&points, 2.5, false);
        let triple = generate_running_stitches(&points, 2.5, true);

        // Triple stitch should have more stitches
        assert!(triple.len() > single.len());
    }
}
