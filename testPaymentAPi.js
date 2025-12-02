    // Old Payment Api
    app.post("/checkout", async (req, res) => {
      const paymentInfo = req.body;
      const amount = paymentInfo?.totalCost * 100;
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "USD",
              unit_amount: amount,
              product_data: {
                name: `Please Pay For : ${paymentInfo?.percilname}`,
              },
            },
            quantity: 1,
          },
        ],
        customer_email: paymentInfo?.senderemail,
        mode: "payment",
        metadata: {
          parcelid: paymentInfo?.parcelid,
          parcelName: paymentInfo?.percilname,
        },
        success_url: `${process.env.YOUR_DOMAIN}/dasbord/success`,
        cancel_url: `${process.env.YOUR_DOMAIN}/dasbord/cancel`,
      });

      res.send({ url: session.url });
    });