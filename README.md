# detacher

If you are using Cloudant or CouchDB and occasionally storing binary attachments inside documents, then *detacher* may be for you. It is a serverless function that runs in [IBM Cloud Functions](https://www.ibm.com/cloud-computing/bluemix/openwhisk) (based on Apache OpenWhisk) that is invoked whenever a Cloudant document changes. If the document contains attachments, those documents are copied into [Cloud Object Storage](https://www.ibm.com/cloud-computing/products/storage/object-storage/) or [AWS S3](https://aws.amazon.com/s3/) and removed from the document.

This allows the Cloudant database to remain free of binary attachments with no loss of data.

Here is a typical document before

```js
{
  "_id": "7",
  "_rev": "2-920d8da7eb1a1175fcbc10cf6f989d99",
  "first_name": "Glynn",
  "last_name": "Bird",
  "job": "Developer Advocate @ IBM",
  "twitter": "@glynn_bird",
  "_attachments": {
    "headshot.jpg": {
      "content_type": "image/jpeg",
      "revpos": 2,
      "digest": "md5-N0JXExRZxZaOD3sszjMXzA==",
      "length": 46998,
      "stub": true
    }
  }
}
```

CouchDB/Cloudant stores attached files in an object called `_attachmments`. After processing by *detacher*, the document is modified to look like this:

```js
{
  "_id": "7",
  "_rev": "3-c3272191e6e94d3bd2a3d72145c7d4fd",
  "first_name": "Glynn",
  "last_name": "Bird",
  "job": "Developer Advocate @ IBM",
  "twitter": "@glynn_bird",
  "attachments": {
    "headshot.jpg": {
      "content_type": "image/jpeg",
      "revpos": 2,
      "digest": "md5-N0JXExRZxZaOD3sszjMXzA==",
      "length": 46998,
      "stub": true,
      "Location": "https://detacher.s3.eu-west-2.amazonaws.com/7-headshot.jpg",
      "Key": "7-headshot.jpg"
    }
  }
}
```

Notice that the `_attachments` key is no longer there: Cloudant is not storing the attachment anymore. In its place is `attachments` (without the underscore) which contains the same data but with an extra `Location` and `Key` which record where in your Object Storage the file is stored.

## Pre-requisites

You need:

- [Node.js/npm](https://nodejs.org/en/) installed
- an [IBM Cloud Functions](https://www.ibm.com/cloud-computing/bluemix/openwhisk) account with the [bx](https://console.bluemix.net/docs/cli/reference/bluemix_cli/get_started.html#getting-started) and [bx wsk plugin](https://console.bluemix.net/docs/openwhisk/bluemix_cli.html#cloudfunctions_cli) installed and configured
- an [IBM Cloudant](https://www.ibm.com/analytics/us/en/technology/cloud-data-services/cloudant/) database service. We need its hostname, username, password and database name.
- an [IBM Cloud Object Storage](https://www.ibm.com/cloud-computing/products/storage/object-storage/) service or an [Amazon S3](https://aws.amazon.com/s3/) service. We need the api key, secret and bucket name to deploy this tool

## Installation

Ensure you have a new "bucket" in your Object Storage service and a new database in your Cloudant service.

Set up environment variables containing the credentials of your Cloudant service and Object storage service:

```sh
export CLOUDANT_HOST="myhost.cloudant.com"
export CLOUDANT_USERNAME="myusername"
export CLOUDANT_PASSWORD="mypassword"
export CLOUDANT_DATABASE="mydatabase"
export AWS_ACCESS_KEY_ID="ABC123"
export AWS_SECRET_ACCESS_KEY="XYZ987"
export AWS_BUCKET="mybucket"
export AWS_REGION="eu-west-2"
export AWS_ENDPOINT="https://ec2.eu-west-2.amazonaws.com"
```

Then run the `deploy.sh` script

```sh
./deploy.sh
```

You can now add document to your database and add an attachment too it. In a few moments the document will have updated and will no longer contain attachments, but references to those files in your object storage.

