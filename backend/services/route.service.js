function findPathAsync(router, opts) {
  return new Promise((resolve, reject) => {
    router.findPath(opts, (err, result) =>
      err ? reject(err) : resolve(result)
    );
  });
}

module.exports = { findPathAsync };
