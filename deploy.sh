#!/bin/bash

# don't deploy without env variables
if [[ -z "${CLOUDANT_HOST}" ]]; then
  echo "Environment variable CLOUDANT_HOST is required"
  exit 1
fi
if [[ -z "${CLOUDANT_USERNAME}" ]]; then
  echo "Environment variable CLOUDANT_USERNAME is required"
  exit 1
fi
if [[ -z "${CLOUDANT_PASSWORD}" ]]; then
  echo "Environment variable CLOUDANT_PASSWORD is required"
  exit 1
fi
if [[ -z "${CLOUDANT_DATABASE}" ]]; then
  echo "Environment variable CLOUDANT_DATABASE is required"
  exit 1
fi
if [[ -z "${AWS_ACCESS_KEY_ID}" ]]; then
  echo "Environment variable AWS_ACCESS_KEY_ID is required"
  exit 1
fi
if [[ -z "${AWS_SECRET_ACCESS_KEY}" ]]; then
  echo "Environment variable AWS_SECRET_ACCESS_KEY is required"
  exit 1
fi
if [[ -z "${AWS_BUCKET}" ]]; then
  echo "Environment variable AWS_BUCKET is required"
  exit 1
fi
if [[ -z "${AWS_REGION}" ]]; then
  echo "Environment variable AWS_REGION is required"
  exit 1
fi

# create a package with the config
bx wsk package create detacher --param CLOUDANT_HOST "$CLOUDANT_HOST" --param CLOUDANT_USERNAME "$CLOUDANT_USERNAME" --param CLOUDANT_PASSWORD "$CLOUDANT_PASSWORD" --param CLOUDANT_DATABASE "$CLOUDANT_DATABASE" --param AWS_ACCESS_KEY_ID "$AWS_ACCESS_KEY_ID" --param AWS_SECRET_ACCESS_KEY "$AWS_SECRET_ACCESS_KEY" --param AWS_REGION "$AWS_REGION" --param AWS_BUCKET "$AWS_BUCKET" --param AWS_ENDPOINT "$AWS_ENDPOINT"

# install dependencies
npm install

# zip up the code and the dependencies
zip -r deploy.zip index.js node_modules

# deploy to IBM Cloud Functionsb
bx wsk action create detacher/detach --kind nodejs:6 deploy.zip
rm deploy.zip

# now the changes feed config
# create a Cloudant connection
bx wsk package bind /whisk.system/cloudant detacherCloudant -p username "$CLOUDANT_USERNAME" -p password "$CLOUDANT_PASSWORD" -p host "$CLOUDANT_HOST"

# a trigger that listens to our database's changes feed
bx wsk trigger create detacherTrigger --feed /_/detacherCloudant/changes --param dbname "$CLOUDANT_DATABASE" 

# a rule to call our action when the trigger is fired
bx wsk rule create detacherRule detacherTrigger detacher/detach

# to delete
#bx wsk action delete detacher/detach
#bx wsk package delete detacher
#bx wsk rule delete detacherRule
#bx wsk trigger delete detacherTrigger