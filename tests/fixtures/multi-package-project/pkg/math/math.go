package math

// Add adds two integers
func Add(a, b int) int {
	return a + b
}

// Subtract subtracts b from a
func Subtract(a, b int) int {
	return a - b
}

// Multiply multiplies two integers
func Multiply(a, b int) int {
	return a * b
}

// Divide divides a by b
func Divide(a, b float64) float64 {
	if b == 0 {
		return 0
	}
	return a / b
}
