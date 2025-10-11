package ratelimit

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	log "github.com/sirupsen/logrus"
)

// Limiter provides rate limiting using Redis
type Limiter struct {
	redis *redis.Client
}

// NewLimiter creates a new rate limiter
func NewLimiter(redisClient *redis.Client) *Limiter {
	return &Limiter{
		redis: redisClient,
	}
}

// CheckVendorLimit checks if vendor throughput limit is exceeded
func (l *Limiter) CheckVendorLimit(ctx context.Context, vendorID string, limit int) (bool, int, error) {
	if limit <= 0 {
		return true, 0, nil // No limit configured
	}

	// Use per-second window for vendor throughput
	window := time.Second
	key := fmt.Sprintf("rate:vendor:%s:%d", vendorID, time.Now().Unix())

	return l.checkLimit(ctx, key, limit, window)
}

// CheckCustomerLimit checks if customer rate limit is exceeded
func (l *Limiter) CheckCustomerLimit(ctx context.Context, customerID string, limitPerMin int) (bool, int, error) {
	if limitPerMin <= 0 {
		return true, 0, nil // No limit configured
	}

	// Use per-minute window for customers
	window := time.Minute
	minute := time.Now().Unix() / 60
	key := fmt.Sprintf("rate:customer:%s:%d", customerID, minute)

	return l.checkLimit(ctx, key, limitPerMin, window)
}

// Check10DLCLimit checks 10DLC hourly and daily limits
func (l *Limiter) Check10DLCLimit(ctx context.Context, sourceAddr string, hourlyLimit, dailyLimit int) (bool, error) {
	now := time.Now()

	// Check hourly limit
	hourKey := fmt.Sprintf("rate:10dlc:hour:%s:%s", sourceAddr, now.Format("2006010215"))
	hourCount, err := l.redis.Incr(ctx, hourKey).Result()
	if err != nil {
		return false, fmt.Errorf("failed to increment hourly counter: %w", err)
	}

	// Set expiry on first increment
	if hourCount == 1 {
		l.redis.Expire(ctx, hourKey, time.Hour)
	}

	if int(hourCount) > hourlyLimit {
		log.WithFields(log.Fields{
			"source":       sourceAddr,
			"hourly_count": hourCount,
			"hourly_limit": hourlyLimit,
		}).Warn("10DLC hourly limit exceeded")
		return false, nil
	}

	// Check daily limit
	dayKey := fmt.Sprintf("rate:10dlc:day:%s:%s", sourceAddr, now.Format("20060102"))
	dayCount, err := l.redis.Incr(ctx, dayKey).Result()
	if err != nil {
		return false, fmt.Errorf("failed to increment daily counter: %w", err)
	}

	// Set expiry on first increment
	if dayCount == 1 {
		l.redis.Expire(ctx, dayKey, 24*time.Hour)
	}

	if int(dayCount) > dailyLimit {
		log.WithFields(log.Fields{
			"source":      sourceAddr,
			"daily_count": dayCount,
			"daily_limit": dailyLimit,
		}).Warn("10DLC daily limit exceeded")
		return false, nil
	}

	return true, nil
}

// checkLimit is a generic rate limit checker using sliding window
func (l *Limiter) checkLimit(ctx context.Context, key string, limit int, window time.Duration) (bool, int, error) {
	// Increment counter
	count, err := l.redis.Incr(ctx, key).Result()
	if err != nil {
		return false, 0, fmt.Errorf("failed to increment counter: %w", err)
	}

	// Set expiry on first increment (creates key)
	if count == 1 {
		if err := l.redis.Expire(ctx, key, window).Err(); err != nil {
			log.WithError(err).Error("Failed to set expiry on rate limit key")
		}
	}

	// Check if limit exceeded
	allowed := int(count) <= limit
	remaining := limit - int(count)
	if remaining < 0 {
		remaining = 0
	}

	if !allowed {
		log.WithFields(log.Fields{
			"key":       key,
			"count":     count,
			"limit":     limit,
			"remaining": remaining,
		}).Warn("Rate limit exceeded")
	}

	return allowed, remaining, nil
}

// GetCurrentCount returns current count for a rate limit key
func (l *Limiter) GetCurrentCount(ctx context.Context, key string) (int64, error) {
	count, err := l.redis.Get(ctx, key).Int64()
	if err == redis.Nil {
		return 0, nil
	} else if err != nil {
		return 0, err
	}

	return count, nil
}

// ResetVendorLimit resets a vendor's rate limit counter (admin function)
func (l *Limiter) ResetVendorLimit(ctx context.Context, vendorID string) error {
	pattern := fmt.Sprintf("rate:vendor:%s:*", vendorID)
	iter := l.redis.Scan(ctx, 0, pattern, 100).Iterator()

	deleted := 0
	for iter.Next(ctx) {
		if err := l.redis.Del(ctx, iter.Val()).Err(); err != nil {
			log.WithError(err).Error("Failed to delete rate limit key")
		} else {
			deleted++
		}
	}

	if err := iter.Err(); err != nil {
		return err
	}

	log.WithFields(log.Fields{
		"vendor_id": vendorID,
		"deleted":   deleted,
	}).Info("Vendor rate limits reset")

	return nil
}
