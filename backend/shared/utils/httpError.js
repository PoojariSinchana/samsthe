// Tiny helpers so controllers can `throw fail(400, "msg")` and answer with one catch block.
const fail = (status, message) => Object.assign(new Error(message), { status });

const send = (res, err, fallback) =>
  res.status(err.status || 500).json(err.status ? { message: err.message } : { message: fallback, error: err.message });

module.exports = { fail, send };