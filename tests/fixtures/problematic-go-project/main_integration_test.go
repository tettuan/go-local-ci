package main

import "testing"

func TestBuggyAddIntegration(t *testing.T) {
	// This integration test will also fail
	result := BuggyAdd(5, 5)
	if result != 11 { // Wrong expected value (should be 10)
		t.Errorf("BuggyAdd(5, 5) = %d; want 11", result)
	}
}