-- WARP Platform LCR Routing Engine
-- High-performance routing with caching and API fallback

local json = require("cjson")
local http = require("socket.http")
local ltn12 = require("ltn12")

-- Configuration
local api_base_url = os.getenv("WARP_API_URL") or "http://api-gateway:8080"
local api_timeout = 2 -- seconds
local cache_ttl = 300 -- 5 minutes
local enable_cache = true

-- Route cache (in-memory for performance)
local route_cache = {}
local cache_timestamps = {}

-- Helper function to make API calls
function api_call(endpoint, params)
    local url = api_base_url .. endpoint
    local response_body = {}
    
    -- Add customer context
    local customer_id = KSR.pv.get("$avp(customer_id)")
    if customer_id then
        params["customer_id"] = customer_id
    end
    
    -- Convert params to query string
    local query_params = {}
    for k, v in pairs(params) do
        table.insert(query_params, k .. "=" .. v)
    end
    if #query_params > 0 then
        url = url .. "?" .. table.concat(query_params, "&")
    end
    
    -- Make HTTP request
    local res, status_code, headers = http.request{
        url = url,
        method = "GET",
        headers = {
            ["Content-Type"] = "application/json",
            ["X-Request-ID"] = KSR.pv.get("$ci") -- Use Call-ID as request ID
        },
        sink = ltn12.sink.table(response_body),
        timeout = api_timeout
    }
    
    if status_code == 200 then
        local body = table.concat(response_body)
        return json.decode(body)
    else
        KSR.err("API call failed: " .. tostring(status_code))
        return nil
    end
end

-- Check if cache entry is still valid
function is_cache_valid(key)
    if not enable_cache then
        return false
    end
    
    local timestamp = cache_timestamps[key]
    if timestamp then
        local age = os.time() - timestamp
        return age < cache_ttl
    end
    return false
end

-- Main routing function
function route_call()
    local called_number = KSR.pv.get("$rU")
    local customer_id = KSR.pv.get("$avp(customer_id)")
    
    if not called_number then
        KSR.err("No called number")
        return false
    end
    
    -- Normalize to E164
    if not string.match(called_number, "^%+") then
        -- Already processed in kamailio.cfg, but double-check
        if string.len(called_number) == 10 then
            called_number = "1" .. called_number
        end
    end
    
    -- Check cache first
    local cache_key = customer_id .. ":" .. called_number
    if is_cache_valid(cache_key) then
        local cached_route = route_cache[cache_key]
        if cached_route then
            apply_route(cached_route)
            KSR.dbg("Using cached route for " .. called_number)
            return true
        end
    end
    
    -- Call routing API
    local params = {
        called_number = called_number,
        calling_number = KSR.pv.get("$fU") or "anonymous"
    }
    
    local route = api_call("/v1/routing/lcr", params)
    
    if route and route.success then
        -- Cache the route
        route_cache[cache_key] = route.data
        cache_timestamps[cache_key] = os.time()
        
        -- Apply the route
        apply_route(route.data)
        return true
    else
        -- Fallback to static routing if API fails
        return fallback_route(called_number)
    end
end

-- Apply routing decision
function apply_route(route)
    -- Set routing variables
    KSR.pv.sets("$avp(route_found)", "1")
    KSR.pv.sets("$avp(carrier_id)", tostring(route.carrier_id))
    KSR.pv.sets("$avp(rate)", tostring(route.rate))
    KSR.pv.sets("$avp(route_name)", route.route_name or "")
    
    -- Set destination URI
    if route.sip_uri then
        KSR.pv.sets("$ru", route.sip_uri)
    else
        -- Build SIP URI from components
        local uri = "sip:" .. KSR.pv.get("$rU") .. "@" .. route.gateway
        if route.port and route.port ~= 5060 then
            uri = uri .. ":" .. tostring(route.port)
        end
        KSR.pv.sets("$ru", uri)
    end
    
    -- Set custom headers if needed
    if route.headers then
        for header, value in pairs(route.headers) do
            KSR.hdr.append(header .. ": " .. value)
        end
    end
    
    -- Set caller ID transformation
    if route.force_clid then
        KSR.pv.sets("$avp(force_clid)", route.force_clid)
    end
    
    -- Set codec preferences
    if route.codecs then
        KSR.pv.sets("$avp(codecs)", table.concat(route.codecs, ","))
    end
    
    KSR.info("Route found: " .. route.route_name .. " via carrier " .. route.carrier_id)
end

-- Fallback routing when API is unavailable
function fallback_route(called_number)
    -- Simple pattern-based fallback routing
    local carrier_id = 1 -- Default carrier
    
    -- US/Canada
    if string.match(called_number, "^1") then
        carrier_id = 1
    -- International
    else
        carrier_id = 2
    end
    
    -- Apply fallback route
    local route = {
        carrier_id = carrier_id,
        gateway = "carrier" .. carrier_id .. ".example.com",
        port = 5060,
        route_name = "fallback",
        rate = 0.01
    }
    
    apply_route(route)
    KSR.warn("Using fallback route for " .. called_number)
    return true
end

-- Check number portability
function check_lrn(number)
    -- Quick LRN cache check
    local cache_key = "lrn:" .. number
    if is_cache_valid(cache_key) then
        local lrn = route_cache[cache_key]
        if lrn then
            return lrn
        end
    end
    
    -- Call LRN API
    local params = {
        number = number
    }
    
    local result = api_call("/v1/telco/lrn", params)
    
    if result and result.success and result.data.lrn then
        -- Cache LRN result
        route_cache[cache_key] = result.data.lrn
        cache_timestamps[cache_key] = os.time()
        return result.data.lrn
    end
    
    -- Return original number if LRN lookup fails
    return number
end

-- Clear old cache entries periodically
function cleanup_cache()
    local now = os.time()
    local expired = {}
    
    for key, timestamp in pairs(cache_timestamps) do
        if now - timestamp > cache_ttl then
            table.insert(expired, key)
        end
    end
    
    for _, key in ipairs(expired) do
        route_cache[key] = nil
        cache_timestamps[key] = nil
    end
    
    KSR.dbg("Cleaned up " .. #expired .. " expired cache entries")
end

-- Initialize module
function mod_init()
    KSR.info("WARP LCR Routing Engine initialized")
    -- Set up periodic cache cleanup (called by Kamailio timer)
    return 1
end