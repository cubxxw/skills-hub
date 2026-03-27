#!/bin/bash

# Quick verification script for Skills API fix
# Tests that the API returns the correct format

API_URL="${API_URL:-http://8.220.240.187:4000}"

echo "========================================"
echo "  Skills API Verification"
echo "========================================"
echo ""

# Test 1: Check API is reachable
echo "Test 1: Checking API connectivity..."
if curl -s "$API_URL/api/health" > /dev/null 2>&1; then
    echo "✅ API is reachable at $API_URL"
else
    echo "❌ API is not reachable at $API_URL"
    exit 1
fi
echo ""

# Test 2: Get skills and check response
echo "Test 2: Fetching skills from API..."
RESPONSE=$(curl -s "$API_URL/api/skills")
echo "$RESPONSE" | python3 -m json.tool > /tmp/skills_response.json 2>/dev/null || echo "$RESPONSE" > /tmp/skills_response.txt

if echo "$RESPONSE" | grep -q '"skills"'; then
    echo "✅ Response contains 'skills' field"
else
    echo "❌ Response missing 'skills' field"
    exit 1
fi
echo ""

# Test 3: Check skills count
echo "Test 3: Checking skills count..."
SKILLS_COUNT=$(echo "$RESPONSE" | grep -o '"total":[0-9]*' | grep -o '[0-9]*')
if [ -n "$SKILLS_COUNT" ] && [ "$SKILLS_COUNT" -gt 0 ]; then
    echo "✅ Found $SKILLS_COUNT skills"
else
    echo "⚠️  No skills found (total: $SKILLS_COUNT)"
fi
echo ""

# Test 4: Check for enabled field (new format)
echo "Test 4: Checking for 'enabled' field in skills..."
if echo "$RESPONSE" | grep -q '"enabled":'; then
    echo "✅ Skills have 'enabled' field (new format)"
    ENABLED_COUNT=$(echo "$RESPONSE" | grep -o '"enabled":true' | wc -l)
    echo "   Enabled skills: $ENABLED_COUNT"
else
    echo "⚠️  Skills missing 'enabled' field (old format)"
    echo "   Frontend will use 'status' field for backward compatibility"
fi
echo ""

# Test 5: Check for tags field
echo "Test 5: Checking for 'tags' field in skills..."
if echo "$RESPONSE" | grep -q '"tags":'; then
    echo "✅ Skills have 'tags' field (new format)"
else
    echo "⚠️  Skills missing 'tags' field (old format)"
    echo "   Frontend will use empty array as fallback"
fi
echo ""

# Test 6: Check skill structure
echo "Test 6: Checking skill structure..."
REQUIRED_FIELDS=("id" "name" "description" "version" "status" "createdAt" "updatedAt")
MISSING_FIELDS=()

for field in "${REQUIRED_FIELDS[@]}"; do
    if ! echo "$RESPONSE" | grep -q "\"$field\":"; then
        MISSING_FIELDS+=("$field")
    fi
done

if [ ${#MISSING_FIELDS[@]} -eq 0 ]; then
    echo "✅ All required fields present"
else
    echo "❌ Missing fields: ${MISSING_FIELDS[*]}"
    exit 1
fi
echo ""

# Test 7: Display skills summary
echo "Test 7: Skills Summary"
echo "----------------------------------------"
echo "$RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    skills = data.get('skills', [])
    print(f'Total skills: {len(skills)}')
    for i, skill in enumerate(skills, 1):
        name = skill.get('name', 'Unknown')
        version = skill.get('version', '?')
        enabled = skill.get('enabled', skill.get('status') == 'active')
        tags = skill.get('tags', [])
        status = '🟢 Enabled' if enabled else '🔴 Disabled'
        tags_str = f\" [{', '.join(tags)}]\" if tags else ''
        print(f'  {i}. {name} v{version} - {status}{tags_str}')
except Exception as e:
    print(f'Error parsing response: {e}')
" 2>/dev/null || echo "$RESPONSE" | head -20
echo ""

echo "========================================"
echo "  Verification Complete"
echo "========================================"
echo ""

if [ ${#MISSING_FIELDS[@]} -eq 0 ]; then
    echo -e "\033[0;32m✅ All verification checks passed!\033[0m"
    echo ""
    echo "The API is returning the correct format."
    echo "Frontend should be able to display skills correctly."
    exit 0
else
    echo -e "\033[0;31m❌ Some verification checks failed\033[0m"
    echo ""
    echo "Please review the errors above."
    exit 1
fi
