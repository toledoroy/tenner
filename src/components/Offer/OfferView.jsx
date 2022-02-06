import React, { useState, useEffect, useContext } from 'react';
// import { Table } from 'antd';
// import { Link } from "react-router-dom";
import { Input, Button } from "antd";
import { OfferContractContext } from "context/context";
import { useOffer } from "hooks/useOffer";
import { useIPFS } from "hooks/useIPFS";
import { useMoralis, useMoralisQuery } from "react-moralis";

/**
 * Offer(s) Page
 *
 */
function OfferView(props) {
  const { id: token_id } = props.match.params;
  const { contractData } = useContext(OfferContractContext);
  const [token, setToken] = useState({});
  const [isLoading, setIsLoading] = useState();
  const { resolveLink } = useIPFS();
  const { Moralis, account, isInitialized } = useMoralis();

  //TODO: Make this into a hook
  const [price, setPrice] = useState();
  const [stock, setStock] = useState();
  const [credit, setCredit] = useState();
  const [creator, setCreator] = useState();
  const [statuses, seStatuses] = useState();
  const [isSeller, setIsSeller] = useState();
  const [isBuyer, setIsBuyer] = useState();
  const {
    order, buy,
    getPrice, getSupply, getCredit, getStatus, getCreator
  } = useOffer();
  useEffect(() => {
    if (isInitialized && account) loadOnChainData(token);
  }, [token, isInitialized, account]);
  const loadOnChainData = async (nft) => {
    //Fetch onChain Data


    getPrice(token_id).then(res => setPrice(res));
    getSupply(token_id).then(res => setStock(res));
    getCredit(account, token_id).then(res => setCredit(res));
    getCreator(token_id).then(res => { setCreator(res.toLowerCase()); setIsSeller(res.toLowerCase() === account) });

  };


  useEffect(() => {
    if (token_id) loadOffer(token_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (token_id) {
      loadOffer(token_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token_id]);


  const loadOffer = async (token_id) => {   //TODO: Replace this whole thing with something better when you got the time
    const hash = contractData.hash;
    const chain = contractData.chain;
    console.warn("(i) Offers() Loading Offer" + token_id);
    try {
      //Load Offers
      let apiKey = process?.env?.REACT_APP_MORALIS_API_KEY;
      if (apiKey) {
        if (hash && chain) {
          //Before
          setIsLoading(true);

          let uri = `https://deep-index.moralis.io/api/v2/nft/${hash}?chain=${chain}&format=decimal`;
          let headers = {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          };
          fetch(uri, { headers })
            .then((response) => response.json())
            .then((response) => {

              console.warn("[TEST] Offers.offersGetMoralis() Moralis API Response:", response);

              if (!response?.result) throw new Error("Moralis NFT For Contract Request Returned Invalid Data: " + Json.stringify(response));

              //Find Token
              if (response?.result) {
                for (let nft of response.result) {
                  if (nft.token_id == token_id) {
                    if (nft?.metadata) {
                      nft.metadata = JSON.parse(nft.metadata);
                      // metadata is a string type
                      nft.image = resolveLink(nft.metadata?.image);
                    }
                    //Set NFT
                    setToken(nft);
                    console.warn("(i) Offers.offersGetMoralis() Token Found:", { nft, token_id });
                    break;
                  }
                }
              }
              else setToken();
              //Done Loading
              setIsLoading(false);
            })
            .catch((err) => {
              console.error("Offers.offersGetMoralis() Moralis API Error:", err);
              //Done Loading
              setIsLoading(false);
              //Has Error
              setError(err);
            });
        } else
          console.error("Offers.offersGetMoralis() Missing Parameters", {
            hash,
            chain,
          });
      } else
        console.error(
          "Offers.offersGetMoralis() Can't Run. API Key Missing in ENV",
        );
    } catch (error) {
      console.error(error);
    }
  }

  const { data: evtSold } = useMoralisQuery("mumbaiOfferSoldd", (query) => query.equalTo("token_id", token_id), [], { live: true, });
  const { data: evtOrderMy } = useMoralisQuery("mumbaiOfferOrderd", (query) => query.equalTo("token_id", token_id).equalTo("account", account), [account], { live: true, });
  const { data: evtOrder } = useMoralisQuery("mumbaiOfferOrderd", (query) => query.equalTo("token_id", token_id), [], { live: true, });

  useEffect(() => {
    // if (evtSold) {
    console.warn("(i) OfferSold Ordered:", evtOrder);
    //Fetch Orders Statuses
    loadStatuses();
  }, [evtOrder]);

  const loadStatuses = async () => {
    //Fetch Order Statuses
    let statuses = {};
    for (let order of evtOrder) {
      getStatus(order.get('token_id'), order.get('order_id'), true).then((status) => {
        seStatuses((prevState) => {
          return { ...prevState, [order.get('order_id')]: status };
        });
      });
    }
  };
  return (
    <div className="framed offer">
      <h1>Offer G{token_id}</h1>
      <div className="offer-image">
        <img src={token.image} alt={token.name} style={{ width: '400px' }} />
      </div>
      <div className="offer-info">
        <div> Offer #{token.token_id}</div>
        <div> By: {creator}</div>
        <div> Price: {price}</div>
        <div> Qty: {stock}</div>
      </div>

      <hr />

      {!isSeller && <>
        <h2>Make an Order</h2>
        <div className='offer-actions'>
          <div> Credit: {credit}</div>
          <Input.TextArea
            placeholder={"Fill in order details..."}
            autoSize={{ minRows: 6, maxRows: 6 }}
          />
          {/* Save to IPFS & Send the URI */}
          {credit === 0 ? <div>(You don't have enough credit to make an order)</div> :
            <Button onClick={() => order(token.token_id, "ipfs://QmSWrZDYFXXQhHfVygbptYyrw8qxSUFYsvBvixFzPSn9Qv")} disabled={credit === 0}>Order</Button>
          }
          <br />
          <Button onClick={() => {
            buy(token_id, 1, price)
              .catch(error => {
                message.error("Sorry, Purchase failed.", 10);
                console.error("[TEST] Error buying Token:" + nftToSend.token_id, { amountToSend, price, error });
              });
          }
          }>Buy Another Token</Button>
        </div>

        <hr />
      </>}

      <h2>Stats {isSeller ? "(seller view)" : "(buyer view)"} </h2>
      <div className="offer-stats">
        <h3>Sold {evtSold.length + 1} Units To:</h3>
        <ul>
          <li>{account}</li>
          {evtSold.map((evt) => (
            <li>{evt.get('account')}</li>
          )
          )}
        </ul>

        {isSeller &&
          <div className='orders-pending'>
            <h3>Pending Orders</h3>
            <table>
              <tbody>
                <tr>
                  <th>account</th>
                  <th>orderId</th>
                  <th>URI</th>
                  <th>Status</th>
                  <th>Link</th>
                </tr>
                {evtOrder.map((evt) => (
                  <tr>
                    <td>
                      {evt.get('account')}
                    </td>
                    <td>
                      {'G' + evt.get('token_id') + 'G' + evt.get('order_id')}
                    </td>
                    <td>
                      {evt.get('uri')}
                    </td>

                    <td>
                      {statuses?.[evt?.get('order_id')]}
                    </td>
                    <td>
                      <a href={"/order/" + token.token_id + '/' + evt.get('order_id')}>Order Page</a>
                    </td>
                  </tr>
                )
                )}
              </tbody>
            </table>
          </div>
        }


        {!isSeller &&
          <div className='orders-my'>
            <h3>My Orders</h3>
            <table>
              <tbody>
                <tr>
                  <th>account</th>
                  <th>orderId</th>
                  <th>URI</th>
                  <th>Status</th>
                  <th>Link</th>
                </tr>
                {evtOrderMy.map((evt) => {
                  return (
                    <tr>
                      <td>
                        {evt.get('account')}
                      </td>
                      <td>
                        {'G' + evt.get('token_id') + 'G' + evt.get('order_id')}
                      </td>
                      <td>
                        {evt.get('uri')}
                      </td>

                      <td>
                        {statuses?.[evt?.get('order_id')]}
                      </td>
                      <td>
                        {(evt.get('account') === account)
                          ? <a href={"/order/" + token.token_id + '/' + evt.get('order_id')}>Order Page</a>
                          : <span>(for buyer only)</span>
                        }
                      </td>
                    </tr>);
                })}
              </tbody>
            </table>
          </div>
        }

      </div>
    </div>
  );
} //OfferView()

export default OfferView;
