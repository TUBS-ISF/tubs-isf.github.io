#!/bin/bash
# update-vendor.sh

set -e

echo "Install dependencies..."
npm install

echo "Create vendor-directories..."
mkdir -p css/vendor
mkdir -p js/vendor

echo "Copy CSS..."
cp node_modules/bootstrap/dist/css/bootstrap.min.css css/vendor/
cp node_modules/datatables.net-bs5/css/dataTables.bootstrap5.min.css css/vendor/

echo "Copy JS..."
cp node_modules/jquery/dist/jquery.min.js js/vendor/
cp node_modules/datatables.net/js/dataTables.min.js js/vendor/
cp node_modules/datatables.net-bs5/js/dataTables.bootstrap5.min.js js/vendor/
cp node_modules/papaparse/papaparse.min.js js/vendor/

echo "Done! Vendor-Files updated."
echo ""
echo "Don't forget to commit the changes:"
echo "  git add css/vendor/ js/vendor/"
echo "  git commit -m 'chore: update vendor libraries'"
echo "  git push origin main"