package models

import (
	"sort"
	"strconv"
	"strings"
)

type VideoMetadata struct {
	Bitrate    int    `json:"bitrate"`
	Width      int    `json:"width"`
	Height     int    `json:"height"`
	Resolution string `json:"resolution"`
	Codec      string `json:"codec"`
}

// GetMatchingProfile sorts profiles by Priority (ASC) and returns the first match.
func GetMatchingProfile(v VideoMetadata, p Pipeline) *Profile {
	// Copy profiles to avoid mutating the original slice if it's reused elsewhere
	profiles := make([]Profile, len(p.Profiles))
	copy(profiles, p.Profiles)

	// Sort by priority (Lower number = Higher priority)
	sort.Slice(profiles, func(i, j int) bool {
		return profiles[i].Priority < profiles[j].Priority
	})

	for _, profile := range profiles {
		if EvaluateRule(v, profile.MatchRule) {
			return &profile
		}
	}
	return nil
}

func EvaluateRule(v VideoMetadata, rule MatchRule) bool {
	// Handle Logical Groups
	if rule.LogicalOp == "AND" {
		if len(rule.Rules) == 0 {
			return true
		}
		for _, child := range rule.Rules {
			if !EvaluateRule(v, child) {
				return false
			}
		}
		return true
	}
	if rule.LogicalOp == "OR" {
		if len(rule.Rules) == 0 {
			return false
		}
		for _, child := range rule.Rules {
			if EvaluateRule(v, child) {
				return true
			}
		}
		return false
	}

	// Handle Leaf Rule
	var targetValue int
	var compareValue int
	isNumeric := false

	switch rule.Property {
	case "bitrate":
		targetValue = v.Bitrate
		compareValue, _ = strconv.Atoi(rule.Value)
		isNumeric = true
	case "width":
		targetValue = v.Width
		compareValue, _ = strconv.Atoi(rule.Value)
		isNumeric = true
	case "height":
		targetValue = v.Height
		compareValue, _ = strconv.Atoi(rule.Value)
		isNumeric = true
	case "codec":
		return compareStrings(v.Codec, rule.Operator, rule.Value)
	}

	if isNumeric {
		switch rule.Operator {
		case ">":
			return targetValue > compareValue
		case "<":
			return targetValue < compareValue
		case "==", "is":
			return targetValue == compareValue
		case "!=", "is not":
			return targetValue != compareValue
		case "between":
			parts := strings.Split(rule.Value, "-")
			if len(parts) == 2 {
				min, _ := strconv.Atoi(parts[0])
				max, _ := strconv.Atoi(parts[1])
				return targetValue >= min && targetValue <= max
			}
		}
	}
	return false
}

func compareStrings(actual, operator, expected string) bool {
	switch operator {
	case "==", "is":
		return actual == expected
	case "!=", "is not":
		return actual != expected
	case "contains":
		return strings.Contains(actual, expected)
	}
	return false
}
