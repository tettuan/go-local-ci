package main

import "fmt"

func main() {
	fmt.Println("Hello, World!") // Missing indentation (gofmt issue)
}

// BuggyAdd has intentional bugs for testing
func BuggyAdd(a, b int) int { // Poor formatting (missing spaces)
	unused := 42 // Unused variable (vet issue)
	return a + b // Missing spaces (formatting issue)
}
