const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express().use(bodyParser.json());

const TOKEN =
  'EAAZAZCQSv7GNgBP7FC8WiZBxXaPnppVEfqOk5CbQGSKzvzwa91tjtAwZCr26r6A5XX430L65EcXxdjZCxrdwl9qX49KBGNscB124KG3b9zmcLiu12DKgmWiwmgKug3nAPNlEtyFqPZBZBZBXbve5FCdZApGZA5Sq6t8asMZCexmun0zqEyn9s9ms0a5chDdi4gt150coT49T8vtgZAIg7YOsiZCmYdpQY67NJfmMTttVCcZCj9qWxAfsZAgvZCHj3hASJ8RoLFNgnTXZAgB3ELIZBBNLx0aAZDZD';
const PHONE_NUMBER_ID = '871507329381386';

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === 'ysacc123') {
    console.log('WEBHOOK VERIFICADO');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  const entry = req.body.entry?.[0].changes?.[0]?.value;

  const message = entry?.messages?.[0];
  if (message) {
    const from = message.from;
    const text = message.text?.body;

    console.log('Mensaje recibido:', text);

    await axios({
      method: 'POST',
      url: `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      data: {
        messaging_product: 'whatsapp',
        to: from,
        text: { body: `Hola! Recibí tu mensaje: ${text}` },
      },
    });
  }

  res.sendStatus(200);
});

app.listen(3000, () => console.log('Webhook activo en puerto 3000'));
