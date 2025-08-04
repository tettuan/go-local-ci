package main

import "testing"

func TestBuggyAddUnit(t *testing.T) {
	// This unit test will also fail
	result := BuggyAdd(1, 1)
	if result != 3 { // Wrong expected value (should be 2)
		t.Errorf("BuggyAdd(1, 1) = %d; want 3", result)
	}
}