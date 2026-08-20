package security

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

type Policy struct {
	TrustProxy bool
	Burst      int
	Rate       rate.Limit
	MaxClients int

	mu      sync.Mutex
	clients map[string]*rate.Limiter
}

func NewPolicy(trustProxy bool, requestsPerSecond rate.Limit, burst, maxClients int) *Policy {
	if burst < 1 {
		burst = 20
	}
	if maxClients < 1 {
		maxClients = 10000
	}
	return &Policy{
		TrustProxy: trustProxy,
		Burst:      burst,
		Rate:       requestsPerSecond,
		MaxClients: maxClients,
		clients:    make(map[string]*rate.Limiter),
	}
}

func (p *Policy) ClientKey(r *http.Request) string {
	if p.TrustProxy {
		if forwarded := strings.TrimSpace(strings.Split(r.Header.Get("X-Forwarded-For"), ",")[0]); forwarded != "" {
			return forwarded
		}
	}
	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err == nil && host != "" {
		return host
	}
	return strings.TrimSpace(r.RemoteAddr)
}

func (p *Policy) Allow(key string) bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	limiter := p.clients[key]
	if limiter == nil {
		if len(p.clients) >= p.MaxClients {
			return false
		}
		limiter = rate.NewLimiter(p.Rate, p.Burst)
		p.clients[key] = limiter
	}
	return limiter.Allow()
}

func (p *Policy) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !p.Allow(p.ClientKey(r)) {
			w.Header().Set("Retry-After", "1")
			http.Error(w, "rate limit exceeded", http.StatusTooManyRequests)
			return
		}
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; frame-ancestors 'none'; base-uri 'none'")
		next.ServeHTTP(w, r)
	})
}

func CleanupInterval() time.Duration { return 10 * time.Minute }
