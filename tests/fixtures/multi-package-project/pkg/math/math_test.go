package math

import "testing"

func TestAdd(t *testing.T) {
	if Add(2, 3) != 5 {
		t.Error("Add(2, 3) should equal 5")
	}
}

func TestSubtract(t *testing.T) {
	if Subtract(5, 3) != 2 {
		t.Error("Subtract(5, 3) should equal 2")
	}
}

func TestMultiply(t *testing.T) {
	if Multiply(3, 4) != 12 {
		t.Error("Multiply(3, 4) should equal 12")
	}
}

func TestDivide(t *testing.T) {
	if Divide(10.0, 2.0) != 5.0 {
		t.Error("Divide(10.0, 2.0) should equal 5.0")
	}

	// Test division by zero
	if Divide(10.0, 0.0) != 0.0 {
		t.Error("Divide(10.0, 0.0) should equal 0.0")
	}
}
