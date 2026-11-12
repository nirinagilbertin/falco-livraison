const asyncHandler = require('../utils/asyncHandler');
const { success, created } = require('../utils/response');
const paiementService = require('../services/paiement.service');

// 201 si le paiement est validé ; 402 s'il échoue (la tentative est tout de même enregistrée)
const pay = asyncHandler(async (req, res) => {
  const result = await paiementService.pay(req.user, req.validated.params.id, req.body);
  if (!result.ok) {
    return res.status(402).json({
      success: false,
      error: { code: 'PAYMENT_FAILED', message: result.paiement.motif_echec },
      data: { paiement: result.paiement },
    });
  }
  return created(res, { paiement: result.paiement, recu: result.recu }, 'Paiement validé');
});

const list = asyncHandler(async (req, res) => success(res, await paiementService.listByDemande(req.user, req.validated.params.id)));

module.exports = { pay, list };