package security

import (
	"net/http/httptest"
	"testing"

	"golang.org/x/time/rate"
)

func TestClientKeyDoesNotTrustForwardedHeadersByDefault(t *testing.T) {
	policy := NewPolicy(false, rate.Limit(1), 1, 10)
	req := httptest.NewRequest("GET", "/", nil)
	req.RemoteAddr = "10.0.0.2:1234"
	req.Header.Set("X-Forwarded-For", "198.51.100.10")
	if got := policy.ClientKey(req); got != "10.0.0.2" {
		t.Fatalf("client key = %q, want remote address", got)
	}
}

func TestClientKeyUsesForwardedAddressOnlyWhenTrusted(t *testing.T) {
	policy := NewPolicy(true, rate.Limit(1), 1, 10)
	req := httptest.NewRequest("GET", "/", nil)
	req.RemoteAddr = "10.0.0.2:1234"
	req.Header.Set("X-Forwarded-For", "198.51.100.10, 10.0.0.1")
	if got := policy.ClientKey(req); got != "198.51.100.10" {
		t.Fatalf("client key = %q, want forwarded address", got)
	}
}
