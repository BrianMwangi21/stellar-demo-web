import React, { Component } from 'react';
import { Container, Row, Col, Card, Button, Form, Table} from 'react-bootstrap';
import StellarSdk from 'stellar-sdk';
// import shilingiAsset from './Shilingi';
import LoadingOverlay from 'react-loading-overlay';
import firebase from './Firebase';
import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';

class App extends Component {
  // Constructor to init state
  constructor(props){
    super(props);
    this.state = {
      stellerTestUrl: "https://horizon-testnet.stellar.org",
      log: [],
      richlist: [],
      isActive: false,
      fullnames: "",
      phonenumber: "",
      email: ""
    }

    this.handleSubmit = this.handleSubmit.bind(this);
  };

  componentDidMount() {
    // Create server object and save to state
    const server = new StellarSdk.Server(this.state.stellerTestUrl);

    // Check if URLs align
    const server_response_url =  server.serverURL._parts.protocol + "://" + server.serverURL._parts.hostname;
    if( server_response_url === this.state.stellerTestUrl ) {
      // Set log info
      const log = new Date() + " : Connection successful to Steller Horizon Network.";
      
      this.setState({
        log: [...this.state.log, log]
      })
    }else {
      // Set log info
      const log = new Date() + " : Connection failed to Steller Horizon Network.";
      
      this.setState({
        log: [...this.state.log, log]
      })
    }

    // Get the richlist from firebase
    const db = firebase.firestore();
    db.collection("accounts").onSnapshot((snapshot) => {
        snapshot.forEach((doc) => {
          const data = doc.data()
          this.setState({
            richlist: [...this.state.richlist, data]
          })
        });
    });
  }

  handleSubmit = async(e) => {
    // Set ovelay
    this.setState({
      isActive: true
    });

    e.preventDefault();
    const formdata = new FormData(e.target);

    // First get the payment
    const axios = require('axios');
    axios.defaults.headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Origin, X-Requested-With, Content-Type, Accept",
        "Content-Type": "application/json",
        "username": "sandbox",
        "apiKey": "a3726b0726f6f8688fb166fd4768b7729e5081e76b2946fb387cbe1a66d4ef79"
    }
    const data = {
        "username": "sandbox",
        "productName": "Shilingi",
        "phoneNumber": formdata.get("phonenumber"),
        "currencyCode": "KES",
        "amount": 120.00
    }

    axios.post(
        "https://cors-anywhere.herokuapp.com/https://payments.sandbox.africastalking.com/mobile/checkout/request",
        data
    ).then(response => {
      console.log(response);
    }).catch(e => {
      console.log(e);
    })

    // Use shilingi source 1, the distributor, and create random destination
    const server = new StellarSdk.Server('https://horizon-testnet.stellar.org');
    const issuingKeys = StellarSdk.Keypair.fromSecret('SAP467V4Q5MQGTDKOLJS2EBPDMIQECUNI632N2VTOBPZ2V76K4D2TCG7');
    const source = StellarSdk.Keypair.fromSecret('SCVDA7G3S55ZKA26Q7ZV4DN3BCQRDTHWVY4OXFVCSAEKJZ7PDKJEKG2V');
    const destination = StellarSdk.Keypair.random();

    // Create account, Give 1 XLM as initial balance
    server.accounts()
      .accountId(source.publicKey())
      .call()
      .then(({ sequence }) => {
        const account = new StellarSdk.Account(source.publicKey(), sequence)
        const transaction = new StellarSdk.TransactionBuilder(account, {
          fee: StellarSdk.BASE_FEE,
          networkPassphrase: StellarSdk.Networks.TESTNET
        })
        .addOperation(StellarSdk.Operation.createAccount({
          destination: destination.publicKey(),
          startingBalance: '10'
        }))
        .addOperation(StellarSdk.Operation.changeTrust({
          source: destination.publicKey(),
          asset: new StellarSdk.Asset('KES4042', issuingKeys.publicKey())
        }))
        .addOperation(StellarSdk.Operation.payment({
          destination: destination.publicKey(),
          asset: new StellarSdk.Asset('KES4042', issuingKeys.publicKey()),
          amount: '100'
        }))
        .setTimeout(100)
        .build()
        transaction.sign(source)
        transaction.sign(destination)
        return server.submitTransaction(transaction)
      })
      .then(results => {
        console.log("Account created, trusted and token issued", results, source.publicKey(), destination.publicKey());

        // Save on firebase
        const db = firebase.firestore();
        db.collection("accounts").add({
          fullnames: formdata.get("fullnames"),
          email: formdata.get("email"),
          phonenumber : formdata.get("phonenumber"), 
          account_pubkey: destination.publicKey(),
          account_secret: destination.secret(),
          kes4202_tokens: "100",
          transaction_href: results._links.transaction.href,
          timestamp: new Date()
        });
        
        // Log new state
        const log = new Date() + 
                    " : Account " + destination.publicKey().substring(0,5) + "... created." +
                    " View transaction at : " + results._links.transaction.href + "."

        this.setState({
          log: [...this.state.log, log],
          richlist: [],
          isActive: false,
          fullnames: "",
          phonenumber: "",
          email: ""
        })
      })
      .catch(function(error) {
        console.error('Error!', error);
      });
  };
  
  render() {
    return (
      <LoadingOverlay active={this.state.isActive} spinner text='Creating and funding your account...'>
        <div className="App">
          <Container>
            <Row>
              <Col sm>
                <h1 style={{"paddingTop":"16px"}}>stellar-demo</h1>
                <h6 style={{"paddingTop":"4px"}}>by Mwangi Kabiru</h6>
                <hr style={{"width":"100%"}} />
              </Col>
            </Row>

            <Row>
                <Col sm={8}>

                  <div style={{"width":"100%"}}>
                    <Card>
                      <Card.Header>Creare an account</Card.Header>
                      <Card.Body>
                        <Form style={{"textAlign":"left"}} onSubmit={this.handleSubmit}>
                          <Form.Group>
                            <Form.Label>Full Names</Form.Label>
                            <Form.Control type="text" name="fullnames" placeholder="Enter your fullnames" required />
                          </Form.Group>

                          <Form.Group>
                            <Form.Label>Phone Number</Form.Label>
                            <Form.Control type="text" name="phonenumber" placeholder="Enter your phone number in the form of : +254716XXXXXX" required />
                            <Form.Text className="text-muted">
                              Since the ratio of the Shilingi token to the Kenyan currency is 1:1.2, you will be charged 120 KES for 100 Shilingi tokens. <br />
                              Read the <a href="/">white paper</a> for more info
                            </Form.Text>
                          </Form.Group>

                          <Form.Group>
                            <Form.Label>Email Address</Form.Label>
                            <Form.Control type="email" name="email" placeholder="Enter your email address" required />
                            <Form.Text className="text-muted">
                              We'll never share your email with anyone else.
                            </Form.Text>
                          </Form.Group>

                          <Button variant="primary" type="submit">
                            Submit
                          </Button>
                        </Form>
                      </Card.Body>
                    </Card>
                  </div>

                  <div style={{"width":"100%", "marginTop":"20px"}}>
                    <Card>
                      <Card.Header>Richlist</Card.Header>
                      <Card.Body>
                        <Table striped style={{"textAlign":"left"}}>
                          <thead>
                            <tr>
                              <th>Account</th>
                              <th>Secret</th>
                            </tr>
                          </thead>
                          <tbody>
                            {this.state.richlist.map((account) => {
                              return(
                                <tr>
                                  <td>{account.account_pubkey.substring(0,3) + "..." + account.account_pubkey.slice(account.account_pubkey.length - 2)}</td>
                                  <td>{account.account_secret}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </Table>
                      </Card.Body>
                    </Card>
                  </div>

                </Col>

                <Col sm={4}>
                  <Card>  
                    <Card.Header>Log</Card.Header>
                    <Card.Body style={{"textAlign":"left", "fontSize":"12px"}}>
                      <p>
                        {this.state.log.reverse().map((log) => {
                          return(
                            <p>{log}</p>
                          )
                        })}
                      </p>
                    </Card.Body>
                  </Card>
                </Col>
            </Row>
          </Container>  
        </div>
      </LoadingOverlay>
    );
  }
}

export default App;