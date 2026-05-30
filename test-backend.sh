#!/usr/bin/env bash
# VMTrak Phase 1 backend smoke tests
# Usage: BASE_URL=http://localhost:3001 bash test-backend.sh

BASE="${BASE_URL:-http://localhost:3001}"
PASS=0
FAIL=0

green="\033[32m"
red="\033[31m"
reset="\033[0m"

ok()   { echo -e "${green}PASS${reset} $1"; ((PASS++)); }
fail() { echo -e "${red}FAIL${reset} $1 — $2"; ((FAIL++)); }

# ── Health ────────────────────────────────────────────────────────────────────
echo "── Health ──"
r=$(curl -sf "$BASE/api/health")
echo "$r" | grep -q '"status":"ok"' && ok "/api/health" || fail "/api/health" "$r"

# ── Login — bad creds ─────────────────────────────────────────────────────────
echo "── Auth ──"
r=$(curl -sf -o /dev/null -w "%{http_code}" -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"wrong"}')
[ "$r" = "401" ] && ok "login bad creds → 401" || fail "login bad creds" "got $r"

# ── Login — good creds ────────────────────────────────────────────────────────
r=$(curl -sf -c /tmp/vmtrak-cookies.txt -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"changeme"}')
TOKEN=$(echo "$r" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
[ -n "$TOKEN" ] && ok "login good creds → accessToken" || fail "login good creds" "$r"

# ── /me ───────────────────────────────────────────────────────────────────────
r=$(curl -sf "$BASE/api/auth/me" -H "Authorization: Bearer $TOKEN")
echo "$r" | grep -q '"username":"admin"' && ok "/auth/me → admin" || fail "/auth/me" "$r"

# ── Token refresh ─────────────────────────────────────────────────────────────
r=$(curl -sf -b /tmp/vmtrak-cookies.txt -c /tmp/vmtrak-cookies.txt \
  -X POST "$BASE/api/auth/refresh")
NEW_TOKEN=$(echo "$r" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
[ -n "$NEW_TOKEN" ] && ok "/auth/refresh → new accessToken" || fail "/auth/refresh" "$r"
TOKEN="$NEW_TOKEN"

# ── Dashboard stats ───────────────────────────────────────────────────────────
echo "── Dashboard ──"
r=$(curl -sf "$BASE/api/dashboard/stats" -H "Authorization: Bearer $TOKEN")
echo "$r" | grep -q '"total"' && ok "/dashboard/stats" || fail "/dashboard/stats" "$r"

# ── VM list (empty) ───────────────────────────────────────────────────────────
echo "── VMs ──"
r=$(curl -sf "$BASE/api/vms" -H "Authorization: Bearer $TOKEN")
echo "$r" | grep -q '"data"' && ok "GET /vms (empty)" || fail "GET /vms" "$r"

# ── Create VM ─────────────────────────────────────────────────────────────────
r=$(curl -sf -X POST "$BASE/api/vms" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "vm_name":"TEST-VM-01",
    "ip_address":"192.168.1.100",
    "os_type":"Windows",
    "environment":"test",
    "status":"active",
    "owner":"test@example.com",
    "expiry_date":"2099-12-31"
  }')
VM_ID=$(echo "$r" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
[ -n "$VM_ID" ] && ok "POST /vms → id=$VM_ID" || fail "POST /vms" "$r"

# ── Get single VM ─────────────────────────────────────────────────────────────
r=$(curl -sf "$BASE/api/vms/$VM_ID" -H "Authorization: Bearer $TOKEN")
echo "$r" | grep -q "TEST-VM-01" && ok "GET /vms/$VM_ID" || fail "GET /vms/$VM_ID" "$r"

# ── Update VM ─────────────────────────────────────────────────────────────────
r=$(curl -sf -X PUT "$BASE/api/vms/$VM_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"power_state":"on","vcpu":4,"ram_gb":8}')
echo "$r" | grep -q '"power_state":"on"' && ok "PUT /vms/$VM_ID" || fail "PUT /vms/$VM_ID" "$r"

# ── RDP download ──────────────────────────────────────────────────────────────
r=$(curl -sf "$BASE/api/vms/$VM_ID/rdp?user=Administrator" \
  -H "Authorization: Bearer $TOKEN")
echo "$r" | grep -q "full address" && ok "GET /vms/$VM_ID/rdp" || fail "RDP download" "$r"

# ── Add credential ────────────────────────────────────────────────────────────
echo "── Credentials ──"
r=$(curl -sf -X POST "$BASE/api/vms/$VM_ID/credentials" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"Administrator","password":"S3cur3Pass!","account_type":"admin"}')
CRED_ID=$(echo "$r" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
[ -n "$CRED_ID" ] && ok "POST credential → id=$CRED_ID" || fail "POST credential" "$r"

# ── List credentials (masked) ─────────────────────────────────────────────────
r=$(curl -sf "$BASE/api/vms/$VM_ID/credentials" -H "Authorization: Bearer $TOKEN")
echo "$r" | grep -q "Administrator" && ok "GET credentials (masked)" || fail "GET credentials" "$r"
echo "$r" | grep -q "S3cur3Pass" && fail "password leaked in list!" "plaintext visible" || ok "password masked in list"

# ── Reveal credential ─────────────────────────────────────────────────────────
r=$(curl -sf "$BASE/api/vms/$VM_ID/credentials/$CRED_ID/reveal" \
  -H "Authorization: Bearer $TOKEN")
echo "$r" | grep -q "S3cur3Pass!" && ok "credential reveal → correct plaintext" || fail "credential reveal" "$r"

# ── Users list ────────────────────────────────────────────────────────────────
echo "── Users ──"
r=$(curl -sf "$BASE/api/users" -H "Authorization: Bearer $TOKEN")
echo "$r" | grep -q '"username":"admin"' && ok "GET /users" || fail "GET /users" "$r"

# ── Audit log ─────────────────────────────────────────────────────────────────
echo "── Audit ──"
r=$(curl -sf "$BASE/api/audit" -H "Authorization: Bearer $TOKEN")
echo "$r" | grep -q '"data"' && ok "GET /audit" || fail "GET /audit" "$r"
COUNT=$(echo "$r" | grep -o '"total":[0-9]*' | cut -d: -f2)
[ "${COUNT:-0}" -gt 5 ] && ok "audit log has $COUNT entries" || fail "audit log count" "only $COUNT entries"

# ── Unauthenticated rejection ─────────────────────────────────────────────────
echo "── Auth guards ──"
r=$(curl -sf -o /dev/null -w "%{http_code}" "$BASE/api/vms")
[ "$r" = "401" ] && ok "unauthenticated GET /vms → 401" || fail "auth guard" "got $r"

# ── Support role cannot create VM ─────────────────────────────────────────────
# Create a support user first
curl -sf -X POST "$BASE/api/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"support1","email":"support1@test.local","password":"Support123!","role":"support"}' > /dev/null

SUP_TOKEN=$(curl -sf -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"support1","password":"Support123!"}' | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

r=$(curl -sf -o /dev/null -w "%{http_code}" -X POST "$BASE/api/vms" \
  -H "Authorization: Bearer $SUP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"vm_name":"HACK-VM","power_state":"on"}')
[ "$r" = "403" ] && ok "support cannot POST /vms → 403" || fail "role guard" "got $r"

# Support CAN reveal credentials
r=$(curl -sf -o /dev/null -w "%{http_code}" \
  "$BASE/api/vms/$VM_ID/credentials/$CRED_ID/reveal" \
  -H "Authorization: Bearer $SUP_TOKEN")
[ "$r" = "200" ] && ok "support CAN reveal credentials → 200" || fail "support reveal" "got $r"

# ── Cleanup — delete test VM ──────────────────────────────────────────────────
echo "── Cleanup ──"
r=$(curl -sf -o /dev/null -w "%{http_code}" -X DELETE "$BASE/api/vms/$VM_ID" \
  -H "Authorization: Bearer $TOKEN")
[ "$r" = "200" ] && ok "DELETE /vms/$VM_ID" || fail "DELETE /vms/$VM_ID" "got $r"

# ── Logout ────────────────────────────────────────────────────────────────────
r=$(curl -sf -b /tmp/vmtrak-cookies.txt -X POST "$BASE/api/auth/logout" \
  -H "Authorization: Bearer $TOKEN")
echo "$r" | grep -q '"ok":true' && ok "logout" || fail "logout" "$r"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "────────────────────────────────"
echo -e "Results: ${green}${PASS} passed${reset}  ${red}${FAIL} failed${reset}"
[ "$FAIL" -eq 0 ] && echo -e "${green}All tests passed ✓${reset}" || echo -e "${red}${FAIL} test(s) need attention${reset}"
rm -f /tmp/vmtrak-cookies.txt