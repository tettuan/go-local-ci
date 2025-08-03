package main

import (
	"fmt"

	"example.com/multi-package/pkg/math"
)

func main() {
	a, b := 10, 20

	fmt.Printf("Calculator Demo\n")
	fmt.Printf("===============\n")
	fmt.Printf("a = %d, b = %d\n\n", a, b)

	fmt.Printf("Add: %d + %d = %d\n", a, b, math.Add(a, b))
	fmt.Printf("Subtract: %d - %d = %d\n", a, b, math.Subtract(a, b))
	fmt.Printf("Multiply: %d * %d = %d\n", a, b, math.Multiply(a, b))
	fmt.Printf("Divide: %d / %d = %.2f\n", a, b, math.Divide(float64(a), float64(b)))
}
