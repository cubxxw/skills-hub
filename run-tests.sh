#!/bin/bash

# Test Runner Script for AG-UI Skill Platform
# Runs all tests and generates a summary report

set -e

echo "========================================"
echo "  AG-UI Skill Platform - Test Runner"
echo "========================================"
echo ""

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run frontend tests
run_frontend_tests() {
    echo "📦 Running Frontend Tests..."
    echo "----------------------------------------"
    cd "$PROJECT_ROOT/frontend"
    
    if pnpm run test --run 2>&1 | tee /tmp/frontend_test_output.txt; then
        echo -e "${GREEN}✅ Frontend tests passed${NC}"
        ((PASSED_TESTS++))
    else
        echo -e "${RED}❌ Frontend tests failed${NC}"
        ((FAILED_TESTS++))
    fi
    ((TOTAL_TESTS++))
    echo ""
}

# Function to run backend tests
run_backend_tests() {
    echo "📦 Running Backend Tests..."
    echo "----------------------------------------"
    cd "$PROJECT_ROOT/backend"
    
    if pnpm run test --run 2>&1 | tee /tmp/backend_test_output.txt; then
        echo -e "${GREEN}✅ Backend tests passed${NC}"
        ((PASSED_TESTS++))
    else
        echo -e "${RED}❌ Backend tests failed${NC}"
        ((FAILED_TESTS++))
    fi
    ((TOTAL_TESTS++))
    echo ""
}

# Function to run type checking
run_typecheck() {
    echo "📦 Running Type Check..."
    echo "----------------------------------------"
    
    echo "Frontend:"
    cd "$PROJECT_ROOT/frontend"
    if pnpm run typecheck 2>&1; then
        echo -e "${GREEN}✅ Frontend type check passed${NC}"
        ((PASSED_TESTS++))
    else
        echo -e "${RED}❌ Frontend type check failed${NC}"
        ((FAILED_TESTS++))
    fi
    
    echo ""
    echo "Backend:"
    cd "$PROJECT_ROOT/backend"
    if pnpm run typecheck 2>&1; then
        echo -e "${GREEN}✅ Backend type check passed${NC}"
        ((PASSED_TESTS++))
    else
        echo -e "${RED}❌ Backend type check failed${NC}"
        ((FAILED_TESTS++))
    fi
    ((TOTAL_TESTS+=2))
    echo ""
}

# Function to run linter
run_linter() {
    echo "📦 Running Linter..."
    echo "----------------------------------------"
    cd "$PROJECT_ROOT"
    
    # Run lint and capture exit code (warnings are ok, errors are not)
    if pnpm run lint 2>&1 | tee /tmp/lint_output.txt; then
        echo -e "${GREEN}✅ Linter passed (warnings only)${NC}"
        ((PASSED_TESTS++))
    else
        # Check if it's just warnings or actual errors
        if grep -q "error" /tmp/lint_output.txt; then
            echo -e "${RED}❌ Linter failed with errors${NC}"
            ((FAILED_TESTS++))
        else
            echo -e "${YELLOW}⚠️  Linter has warnings${NC}"
            ((PASSED_TESTS++))
        fi
    fi
    ((TOTAL_TESTS++))
    echo ""
}

# Function to build frontend
build_frontend() {
    echo "📦 Building Frontend..."
    echo "----------------------------------------"
    cd "$PROJECT_ROOT/frontend"
    
    if pnpm run build 2>&1 | tee /tmp/build_output.txt; then
        echo -e "${GREEN}✅ Frontend build successful${NC}"
        ((PASSED_TESTS++))
    else
        echo -e "${RED}❌ Frontend build failed${NC}"
        ((FAILED_TESTS++))
    fi
    ((TOTAL_TESTS++))
    echo ""
}

# Function to show summary
show_summary() {
    echo "========================================"
    echo "  Test Summary"
    echo "========================================"
    echo ""
    echo "Total Test Suites: $TOTAL_TESTS"
    echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
    echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
    echo ""
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}🎉 All tests passed!${NC}"
        echo ""
        echo "Next steps:"
        echo "  1. Review test report: cat TEST_REPORT.md"
        echo "  2. Run E2E tests: cd frontend && pnpm run test:e2e"
        echo "  3. Start dev server: pnpm run dev"
        exit 0
    else
        echo -e "${RED}❌ Some tests failed${NC}"
        echo ""
        echo "Please review the failed tests above."
        exit 1
    fi
}

# Main execution
echo "Starting test suite..."
echo ""

run_frontend_tests
run_backend_tests
run_typecheck
run_linter
build_frontend

show_summary
