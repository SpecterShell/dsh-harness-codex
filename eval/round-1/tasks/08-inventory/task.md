The stock data now has items from several warehouses. Add a `--warehouse`
filter to `inventory list` and `inventory low-stock`, so `--warehouse ams`
shows only that site. Without the flag both commands must behave exactly as
they do now, including the JSON shape.

Add tests for the filter and run the suite when you are done.
