// Every route returns true if it has handled the request.
// Route order is explicit and independent from the frontend menu.
export async function dispatchRoutes(context, handlers) {
    for (const handler of handlers) {
        if (await handler(context))
            return true;
    }
    return false;
}
