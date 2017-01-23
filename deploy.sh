#!/bin/bash

# send to OpenWhisk
wsk action update detach detach.js --param-file parameters.json
