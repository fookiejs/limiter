module.exports.cache = async function (ctx) {
    console.log("CACHE PLUGIN INSTALLED...");
    await ctx.model({
        name: 'request_history',
        database: "store",
        schema: {
            model: {
                type: "string",
                required: true,
                uniqueGroup: ["limit"]
            },
            method: {
                type: "string",
                required: true,
                uniqueGroup: ["limit"]
            },
            hash: {
                type: "string",
                required: true,
                uniqueGroup: ["limit"]
            },
        },
        lifecycle: {
            create: {
                role: ["system"],
                modify: []
            },
            read: {
                role: ["system"]
            },
            update: {
                role: ["system"]
            },
            delete: {
                role: ["system"]
            },
            count: {
                role: ["system"]
            }
        }
    })
}


module.exports.client = function (selected_db) {
    return async function (ctx) {
        await ctx.model({
            name: 'limit',
            database: selected_db,
            mixin: ["cache"],
            schema: {
                model: {
                    type: "string",
                    required: true,
                    uniqueGroup: ["limit"]
                },
                method: {
                    type: "string",
                    required: true,
                    uniqueGroup: ["limit"]
                },
                ms: {
                    type: "number",
                    required: true,
                    default: 100
                }
            },
            lifecycle: {
                create: {
                    role: ["system"]
                },
                read: {
                    role: ["system"]
                },
                update: {
                    role: ["system"]
                },
                delete: {
                    role: ["system"]
                },
                count: {
                    role: ["system"]
                }
            }
        })
        await ctx.lifecycle({
            name: "check_limit",
            function: async function (payload, ctx, state) {
                try {
                    if (payload.method == "read" && payload.model == "limit") { return true }

                    const limit_req = await ctx.run({
                        token: true,
                        model: "limit",
                        method: "read",
                        query: {
                            filter: {
                                model: payload.model,
                                method: payload.method
                            }
                        }
                    })
                    if (limit_req.data.length == 0) {
                        return true
                    }
                    const limit_ms = limit_req.data[0].ms
                    const create_history_req = await ctx.axios.post(process.env.CACHE, {
                        model: "request_history",
                        method: "create",
                        token: process.env.SYSTEM_TOKEN,
                        body: {
                            model: payload.model,
                            method: payload.method,
                            hash: payload.token
                        },
                        options: {
                            drop: limit_ms
                        }
                    })
                    const response = create_history_req.data
                    if (!response.status) {
                        return false
                    }
                } catch (error) {
                }
                return true
            }
        })



        const before = ctx.local.get("mixin", "before")

        before.object.lifecycle.create.preRule.push("check_limit")
        before.object.lifecycle.read.preRule.push("check_limit")
        before.object.lifecycle.update.preRule.push("check_limit")
        before.object.lifecycle.delete.preRule.push("check_limit")
        before.object.lifecycle.count.preRule.push("check_limit")

        const res = await ctx.run({
            model: "mixin",
            method: "update",
            token: true,
            body: {
                object: before.object
            }
        })
        console.log(res);

    }
}