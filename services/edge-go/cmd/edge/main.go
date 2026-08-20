package main

import (
	"context"
	"log/slog"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"mc-u.top/qianfu-edge/internal/security"
	"golang.org/x/time/rate"
)

func env(name, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(name)); value != "" {
		return value
	}
	return fallback
}

func main() {
	listen := env("EDGE_LISTEN", "127.0.0.1:8081")
	upstream, err := url.Parse(env("EDGE_UPSTREAM", "http://127.0.0.1:3001"))
	if err != nil || upstream.Scheme == "" || upstream.Host == "" {
		slog.Error("invalid EDGE_UPSTREAM")
		os.Exit(1)
	}
	trustProxy := strings.EqualFold(env("EDGE_TRUST_PROXY", "false"), "true")
	rps, _ := strconv.ParseFloat(env("EDGE_REQUESTS_PER_SECOND", "10"), 64)
	burst, _ := strconv.Atoi(env("EDGE_BURST", "30"))
	policy := security.NewPolicy(trustProxy, rate.Limit(rps), burst, 10000)

	proxy := httputil.NewSingleHostReverseProxy(upstream)
	proxy.ErrorHandler = func(w http.ResponseWriter, _ *http.Request, err error) {
		slog.Error("upstream request failed", "error", err)
		http.Error(w, "upstream unavailable", http.StatusBadGateway)
	}
	proxy.ModifyResponse = func(response *http.Response) error {
		response.Header.Del("Server")
		return nil
	}

	router := chi.NewRouter()
	router.Get("/edge/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true,"service":"qianfu-edge"}`))
	})
	router.Handle("/*", http.HandlerFunc(proxy.ServeHTTP))

	server := &http.Server{
		Addr:              listen,
		Handler:           policy.Middleware(router),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdownCtx)
	}()

	slog.Info("qianfu edge listening", "addr", listen, "upstream", upstream.Host)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		slog.Error("edge server stopped", "error", err)
		os.Exit(1)
	}
}
