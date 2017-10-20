const stream = require('stream');
const AWS = require('aws-sdk');

// returns a 'pass through' stream to which the readStream to be saved
// should be piped e.g. rs.pipe(saveFile(creds, att, filename))
// creds - the object storage credentials
// rs - the ReadStream of data
// att - the CouchDB attachment object
// filename - the filename to save it as
const saveFile = (creds, att, filename) => {

  const s3 = new AWS.S3({
    accessKeyId: creds.AWS_ACCESS_KEY_ID,
    secretAccessKey: creds.AWS_SECRET_ACCESS_KEY,
    region: creds.AWS_REGION});
  const passThrough = new stream.PassThrough();
  const params = {
    Bucket: creds.AWS_BUCKET,
    Key: filename,
    ContentType: att.content_type,
    Body: passThrough
  };
  const options = {partSize: 10 * 1024 * 1024, queueSize: 1};

  // initiate upload, waiting for data to arrive from the stream
  s3.upload(params, options, (err, data) => {

    // if there was no error
    if (!err) {

      // return an object containing the object storage url
      att.Location = data.Location;
      att.Key = data.Key;

      // fire a custom 'uploaded' event
      passThrough.emit('uploaded', att);
    }
  });

  // return the stream
  return passThrough;
};

// main entry point of the OpenWhisk action
// expects the message object to contain
// id - the document id to process
// CLOUDANT_HOST - the hostname of the Cloudant service
// CLOUDANT_USERNAME - the username of the Cloudant service
// CLOUDANT_PASSWORD - the password of the Cloudant service
// CLOUDANT_DATABASE - the name of the Cloudant database to use
// AWS_ACCESS_KEY_ID - the S3 key
// AWS_SECRET_ACCESS_KEY - the s3 secret
// AWS_REGION - the region the S3 bucket lives in
// AWS_BUCKET - the bucket name
const main = (message) => {

  // check for required parameters
  const requiredParams = [
    'id', 
    'CLOUDANT_HOST', 
    'CLOUDANT_USERNAME',
    'CLOUDANT_PASSWORD',
    'CLOUDANT_DATABASE', 
    'AWS_ACCESS_KEY_ID', 
    'AWS_SECRET_ACCESS_KEY', 
    'AWS_REGION', 
    'AWS_BUCKET'
  ];
  var errs = [];
  requiredParams.forEach((p) => {
    if (!message[p]) {
      errs.push(p + ' is a required parameter of this OpenWhisk action');
    }
  });
  if (errs.length > 0) {
    return { err: errs };
  }

  // setup Cloudant library - we need to two Cloudant connections
  // 1) using the "promises" plugin so we can use the Cloudant library with promises
  // 2) using hte "default" plugin so we can get a readable stream of the attachment data
  const cloudant = require('cloudant')({
    account: message.CLOUDANT_HOST, 
    username: message.CLOUDANT_USERNAME,
    password: message.CLOUDANT_PASSWORD,
    plugin: 'promises'
  });
  const cloudantStream = require('cloudant')({
    account: message.CLOUDANT_HOST, 
    username: message.CLOUDANT_USERNAME,
    password: message.CLOUDANT_PASSWORD
  });
  const db = cloudant.use(message.CLOUDANT_DATABASE);
  const dbStream = cloudantStream.use(message.CLOUDANT_DATABASE);

  // fetch the JSON document
  return db.get(message.id).then((doc) => {

    // if there are attachments
    if (typeof doc._attachments === 'object' ) {
      
      // our new array of Object Store attachments
      var attachments = doc.attachments || {};

      // list of Promises
      var tasks = [];

      // for each attachment name
      Object.keys(doc._attachments).forEach((attName) => {

        // get an HTTP stream of its data and pause it
        const p = new Promise((resolve, reject) => {
          console.log('Detatching', attName);
          const att = doc._attachments[attName];
          const contentType = att.content_type;
          const filename = doc._id + '-' + attName;

          // fetch the attachment and pipe it into
          // the stream that points to the S3 bucket
          dbStream.attachment
             .get(message.id, attName)
             .pipe(saveFile(message, att, filename))
             .on('uploaded', (data) => {
               attachments[attName] = data;
               resolve();
             })
             .on('error', reject)
        });

        // build up an array of promises
        tasks.push(p);
      });

      // when all the Promises are resolved
      return Promise.all(tasks).then(() => {
        // save the document data, removing the Cloudant attachment
        // but leaving an "attachments" array with references to the 
        // object storage versions
        delete doc._attachments;
        doc.attachments = attachments;

        // update Cloudant
        return db.insert(doc);
      });

    } else {
      return ({msg: 'no attachments found in docId' + message.id});
    }

  });
};

exports.main = main;