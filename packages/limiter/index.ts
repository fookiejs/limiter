import * as Fookie from "fookie"
import crypto from "crypto"

export async function init_limiter(database: Fookie.Types.DatabaseInterface) {
    const fookie_request_history = await Fookie.Builder.model({
        name: "fookie_request_history",
        database: database,
        schema: {
            model: {
                type: Fookie.Type.Text,
                required: true,
                unique_group: ["limit"],
            },
            method: {
                type: Fookie.Type.Text,
                required: true,
                unique_group: ["limit"],
            },
            hash: {
                type: Fookie.Type.Text,
                required: true,
                unique_group: ["limit"],
            },
        },
    })

    const fookie_request_limit = await Fookie.Builder.model({
        name: "fookie_request_limit",
        database: database,
        schema: {
            model: {
                type: Fookie.Type.Text,
                required: true,
                unique_group: ["limit"],
            },
            method: {
                type: Fookie.Type.Text,
                required: true,
                unique_group: ["limit"],
            },
            ms: {
                type: Fookie.Type.Integer,
                required: true,
                default: 100,
            },
        },
    })

    const check_request_limit = Fookie.Builder.lifecycle(async function check_request_limit(payload, state) {
        if (payload.token === process.env.SYSTEM_TOKEN) {
            return true
        }
        if (payload.method == "read" && payload.model.name == "fookie_limit") {
            return true
        }
        const limit_req = await Fookie.run({
            token: process.env.SYSTEM_TOKEN,
            model: fookie_request_limit,
            method: Fookie.Method.Read,
            query: {
                filter: {
                    model: payload.model.name,
                    method: payload.method,
                },
            },
        })
        if (limit_req.data.length == 0) {
            return true
        }
        const limit = limit_req.data[0]
        const create_history_response = await Fookie.run({
            token: process.env.SYSTEM_TOKEN,
            model: fookie_request_history,
            method: Fookie.Method.Create,
            body: {
                model: payload.model.name,
                method: payload.method,
                hash: await sha256(payload.token),
            },
            options: {
                drop: limit.ms,
            },
        })
        if (!create_history_response.status) {
            return false
        }

        return true
    })

    Fookie.Mixin.Before.bind.create.pre_rule.push(check_request_limit)
    Fookie.Mixin.Before.bind.read.pre_rule.push(check_request_limit)
    Fookie.Mixin.Before.bind.update.pre_rule.push(check_request_limit)
    Fookie.Mixin.Before.bind.delete.pre_rule.push(check_request_limit)
    Fookie.Mixin.Before.bind.count.pre_rule.push(check_request_limit)

    return { fookie_request_history, fookie_request_limit, check_request_limit }
}

async function sha256(input) {
    const msgBuffer = new TextEncoder().encode(input)
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
    return hashHex
}
