package main

import "testing"

func TestBuggyAdd(t *testing.T) {
	// This test will fail intentionally
	result := BuggyAdd(2, 3)
	if result != 6 { // Wrong expected value (should be 5)
		t.Errorf("BuggyAdd(2, 3) = %d; want 6", result)
	}
}
