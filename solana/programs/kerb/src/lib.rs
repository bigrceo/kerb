//! Kerb — wallet-to-wallet OTC for SPL tokens on Solana. A port of the Robinhood Chain `Desk` contract;
//! the rules do not change, only the chain.
//!
//! Asks
//!   A maker locks a bag of tokens in the offer's vault and names a total price in SOL. A taker pays the SOL
//!   (plus the taker fee) and receives the tokens in the same transaction.
//!
//! Bids
//!   A maker locks SOL in the offer account for an amount of a token. A holder sends the tokens straight to the
//!   maker and receives the SOL (minus the taker fee) in the same transaction.
//!
//! Every fill is atomic: both legs move or neither does. No pool is touched, so no pool price moves. The program
//! holds nothing but the escrow of open offers: a cancel or an expiry hands it back to the maker, never to anyone
//! else. The admin can only change where the taker fee goes; it cannot touch any escrow.
//!
//! Offers can be private (one named taker), allow partial fills down to a smallest fill, and stand until an
//! expiry. Classic SPL and Token-2022 mints are both accepted; a mint that moves anything but the exact amount
//! (transfer fee) is refused.

use anchor_lang::{prelude::*, system_program};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{self, CloseAccount, Mint, TokenAccount, TokenInterface, TransferChecked},
};

declare_id!("Emkqjg3A7p2WYQTBiTLEhjczR2TeBP94E9PMhCpbq4ia");

/// Taker fee on the SOL leg, in basis points. The maker pays nothing.
pub const FEE_BPS: u64 = 30;
pub const MAX_DURATION: i64 = 30 * 24 * 60 * 60;

pub const CONFIG_SEED: &[u8] = b"config";
pub const OFFER_SEED: &[u8] = b"offer";

pub const ASK: u8 = 0;
pub const BID: u8 = 1;

#[program]
pub mod kerb {
    use super::*;

    /// One-time setup. The caller becomes admin.
    pub fn initialize(ctx: Context<Initialize>, treasury: Pubkey) -> Result<()> {
        let c = &mut ctx.accounts.config;
        c.admin = ctx.accounts.admin.key();
        c.treasury = treasury;
        c.offer_count = 0;
        c.volume = 0;
        c.fills = 0;
        c.bump = ctx.bumps.config;
        emit!(TreasurySet { treasury });
        Ok(())
    }

    pub fn set_treasury(ctx: Context<Admin>, treasury: Pubkey) -> Result<()> {
        ctx.accounts.config.treasury = treasury;
        emit!(TreasurySet { treasury });
        Ok(())
    }

    pub fn set_admin(ctx: Context<Admin>, admin: Pubkey) -> Result<()> {
        ctx.accounts.config.admin = admin;
        Ok(())
    }

    /// Lock `amount` tokens and ask `total` lamports for all of them.
    pub fn post_ask(ctx: Context<PostAsk>, amount: u64, total: u64, min_fill: u64, taker: Pubkey, expiry: i64) -> Result<()> {
        let maker = ctx.accounts.maker.key();
        check(&maker, amount, total, min_fill, &taker, expiry)?;
        let before = ctx.accounts.vault.amount;
        token_interface::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.maker_tokens.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.maker.to_account_info(),
                },
            ),
            amount,
            ctx.accounts.mint.decimals,
        )?;
        ctx.accounts.vault.reload()?;
        require!(ctx.accounts.vault.amount - before == amount, KerbError::InexactTransfer);
        let id = push(&mut ctx.accounts.config, &mut ctx.accounts.offer, ctx.bumps.offer, ASK, maker, ctx.accounts.mint.key(), amount, total, min_fill, taker, expiry);
        emit!(OfferPosted { id, maker, mint: ctx.accounts.mint.key(), side: ASK, amount, total, min_fill, taker, expiry });
        Ok(())
    }

    /// Lock `total` lamports and bid them for `amount` tokens.
    pub fn post_bid(ctx: Context<PostBid>, amount: u64, total: u64, min_fill: u64, taker: Pubkey, expiry: i64) -> Result<()> {
        let maker = ctx.accounts.maker.key();
        check(&maker, amount, total, min_fill, &taker, expiry)?;
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                system_program::Transfer { from: ctx.accounts.maker.to_account_info(), to: ctx.accounts.offer.to_account_info() },
            ),
            total,
        )?;
        let id = push(&mut ctx.accounts.config, &mut ctx.accounts.offer, ctx.bumps.offer, BID, maker, ctx.accounts.mint.key(), amount, total, min_fill, taker, expiry);
        emit!(OfferPosted { id, maker, mint: ctx.accounts.mint.key(), side: BID, amount, total, min_fill, taker, expiry });
        Ok(())
    }

    /// Fill `tokens` of an ask. Pays the maker the price and the treasury the fee, then hands over the tokens.
    pub fn take_ask(ctx: Context<TakeAsk>, tokens: u64) -> Result<()> {
        let taker = ctx.accounts.taker.key();
        let o = &ctx.accounts.offer;
        require!(o.side == ASK, KerbError::NotOpen);
        let remaining = admit(o, &taker, tokens)?;
        let (sol, fee) = quote(o, tokens)?;
        let (id, bump) = (o.id, o.bump);

        pay_from_signer(&ctx.accounts.system_program, &ctx.accounts.taker, &ctx.accounts.maker, sol)?;
        pay_from_signer(&ctx.accounts.system_program, &ctx.accounts.taker, &ctx.accounts.treasury, fee)?;

        let seeds: &[&[u8]] = &[OFFER_SEED, &id.to_le_bytes(), &[bump]];
        let before = ctx.accounts.taker_tokens.amount;
        token_interface::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.taker_tokens.to_account_info(),
                    authority: ctx.accounts.offer.to_account_info(),
                },
                &[seeds],
            ),
            tokens,
            ctx.accounts.mint.decimals,
        )?;
        ctx.accounts.taker_tokens.reload()?;
        require!(ctx.accounts.taker_tokens.amount - before == tokens, KerbError::InexactTransfer);

        let o = &mut ctx.accounts.offer;
        o.filled += tokens;
        if remaining == tokens {
            o.open = false;
        }
        let c = &mut ctx.accounts.config;
        c.volume = c.volume.saturating_add(sol);
        c.fills += 1;
        emit!(OfferFilled { id, taker, tokens, sol, fee, remaining: remaining - tokens });
        Ok(())
    }

    /// Fill `tokens` of a bid. The tokens go from you straight to the maker; the SOL comes to you from the escrow.
    pub fn take_bid(ctx: Context<TakeBid>, tokens: u64) -> Result<()> {
        let taker = ctx.accounts.taker.key();
        let o = &ctx.accounts.offer;
        require!(o.side == BID, KerbError::NotOpen);
        let remaining = admit(o, &taker, tokens)?;
        let (sol, fee) = quote(o, tokens)?;
        let id = o.id;

        let before = ctx.accounts.maker_tokens.amount;
        token_interface::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.taker_tokens.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.maker_tokens.to_account_info(),
                    authority: ctx.accounts.taker.to_account_info(),
                },
            ),
            tokens,
            ctx.accounts.mint.decimals,
        )?;
        ctx.accounts.maker_tokens.reload()?;
        require!(ctx.accounts.maker_tokens.amount - before == tokens, KerbError::InexactTransfer);

        let offer_info = ctx.accounts.offer.to_account_info();
        offer_info.sub_lamports(sol)?;
        ctx.accounts.taker.to_account_info().add_lamports(sol - fee)?;
        ctx.accounts.treasury.to_account_info().add_lamports(fee)?;

        let o = &mut ctx.accounts.offer;
        o.filled += tokens;
        if remaining == tokens {
            o.open = false;
        }
        let c = &mut ctx.accounts.config;
        c.volume = c.volume.saturating_add(sol);
        c.fills += 1;
        emit!(OfferFilled { id, taker, tokens, sol, fee, remaining: remaining - tokens });
        Ok(())
    }

    /// The maker takes an ask down at any time and gets the tokens left back. Anyone can do it after expiry.
    pub fn close_ask(ctx: Context<CloseAsk>) -> Result<()> {
        let o = &ctx.accounts.offer;
        require!(o.side == ASK, KerbError::NotOpen);
        let cancelled = closing(o, &ctx.accounts.signer.key(), Clock::get()?.unix_timestamp)?;
        let (id, bump, left) = (o.id, o.bump, o.amount - o.filled);
        let seeds: &[&[u8]] = &[OFFER_SEED, &id.to_le_bytes(), &[bump]];
        if left > 0 {
            token_interface::transfer_checked(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.key(),
                    TransferChecked {
                        from: ctx.accounts.vault.to_account_info(),
                        mint: ctx.accounts.mint.to_account_info(),
                        to: ctx.accounts.maker_tokens.to_account_info(),
                        authority: ctx.accounts.offer.to_account_info(),
                    },
                    &[seeds],
                ),
                left,
                ctx.accounts.mint.decimals,
            )?;
        }
        // The empty vault's rent goes back to the maker too.
        token_interface::close_account(CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            CloseAccount {
                account: ctx.accounts.vault.to_account_info(),
                destination: ctx.accounts.maker.to_account_info(),
                authority: ctx.accounts.offer.to_account_info(),
            },
            &[seeds],
        ))?;
        ctx.accounts.offer.open = false;
        emit!(OfferClosed { id, cancelled, refunded_tokens: left, refunded_sol: 0 });
        Ok(())
    }

    /// The maker takes a bid down at any time and gets the SOL left back. Anyone can do it after expiry.
    pub fn close_bid(ctx: Context<CloseBid>) -> Result<()> {
        let o = &ctx.accounts.offer;
        require!(o.side == BID, KerbError::NotOpen);
        let cancelled = closing(o, &ctx.accounts.signer.key(), Clock::get()?.unix_timestamp)?;
        let id = o.id;
        let left = o.total - sol_at(o, o.filled)?;
        if left > 0 {
            ctx.accounts.offer.to_account_info().sub_lamports(left)?;
            ctx.accounts.maker.to_account_info().add_lamports(left)?;
        }
        ctx.accounts.offer.open = false;
        emit!(OfferClosed { id, cancelled, refunded_tokens: 0, refunded_sol: left });
        Ok(())
    }
}

/* ================================== rules ================================= */

fn check(maker: &Pubkey, amount: u64, total: u64, min_fill: u64, taker: &Pubkey, expiry: i64) -> Result<()> {
    require!(taker != maker, KerbError::SelfFill);
    require!(amount > 0 && total > 0, KerbError::ZeroAmount);
    require!(min_fill > 0 && min_fill <= amount, KerbError::BadMinFill);
    let now = Clock::get()?.unix_timestamp;
    require!(expiry > now && expiry <= now + MAX_DURATION, KerbError::BadExpiry);
    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn push(c: &mut Config, o: &mut Account<Offer>, bump: u8, side: u8, maker: Pubkey, mint: Pubkey, amount: u64, total: u64, min_fill: u64, taker: Pubkey, expiry: i64) -> u64 {
    let id = c.offer_count;
    c.offer_count += 1;
    o.set_inner(Offer { id, maker, mint, taker, expiry, side, open: true, amount, total, filled: 0, min_fill, bump });
    id
}

/// SOL for the first `tokens` of an offer. Cumulative rounding, so the fills of an offer add up to its exact total.
fn sol_at(o: &Offer, tokens: u64) -> Result<u64> {
    Ok((o.total as u128 * tokens as u128 / o.amount as u128) as u64)
}

/// SOL owed for the next `tokens` of an offer, and the taker fee on it.
pub fn quote(o: &Offer, tokens: u64) -> Result<(u64, u64)> {
    let sol = sol_at(o, o.filled + tokens)? - sol_at(o, o.filled)?;
    Ok((sol, sol * FEE_BPS / 10_000))
}

/// Checks a fill against the offer's terms; returns what was left before it.
fn admit(o: &Offer, taker: &Pubkey, tokens: u64) -> Result<u64> {
    require!(o.open, KerbError::NotOpen);
    require!(Clock::get()?.unix_timestamp < o.expiry, KerbError::Expired);
    require!(*taker != o.maker, KerbError::SelfFill);
    require!(o.taker == Pubkey::default() || *taker == o.taker, KerbError::NotTaker);
    let remaining = o.amount - o.filled;
    require!(tokens > 0 && tokens <= remaining, KerbError::BadFill);
    // Below the smallest fill only to take exactly what is left.
    require!(tokens >= o.min_fill || tokens == remaining, KerbError::BadFill);
    // A fill may not leave a remainder nobody can take.
    require!(remaining - tokens == 0 || remaining - tokens >= o.min_fill, KerbError::BadFill);
    Ok(remaining)
}

/// Who may close an open offer: the maker any time, anyone after expiry. Returns whether it is a cancel.
fn closing(o: &Offer, signer: &Pubkey, now: i64) -> Result<bool> {
    require!(o.open, KerbError::NotOpen);
    if *signer == o.maker {
        return Ok(true);
    }
    require!(now >= o.expiry, KerbError::NotExpired);
    Ok(false)
}

fn pay_from_signer<'info>(sys: &Program<'info, System>, from: &Signer<'info>, to: &AccountInfo<'info>, lamports: u64) -> Result<()> {
    if lamports == 0 {
        return Ok(());
    }
    system_program::transfer(
        CpiContext::new(sys.key(), system_program::Transfer { from: from.to_account_info(), to: to.clone() }),
        lamports,
    )
}

/* ================================= accounts ================================ */

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    pub treasury: Pubkey,
    pub offer_count: u64,
    /// Settled SOL, all offers, fees excluded.
    pub volume: u64,
    pub fills: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Offer {
    pub id: u64,
    pub maker: Pubkey,
    pub mint: Pubkey,
    /// Default (all zeros) = anyone.
    pub taker: Pubkey,
    pub expiry: i64,
    pub side: u8,
    pub open: bool,
    /// Tokens, whole offer.
    pub amount: u64,
    /// Lamports, whole offer.
    pub total: u64,
    pub filled: u64,
    /// Smallest fill in tokens; == amount means all-or-nothing.
    pub min_fill: u64,
    pub bump: u8,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(init, payer = admin, space = 8 + Config::INIT_SPACE, seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, Config>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Admin<'info> {
    pub admin: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump, has_one = admin @ KerbError::NotAdmin)]
    pub config: Account<'info, Config>,
}

#[derive(Accounts)]
pub struct PostAsk<'info> {
    #[account(mut)]
    pub maker: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(init, payer = maker, space = 8 + Offer::INIT_SPACE, seeds = [OFFER_SEED, &config.offer_count.to_le_bytes()], bump)]
    pub offer: Account<'info, Offer>,
    #[account(mint::token_program = token_program)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut, token::mint = mint, token::authority = maker, token::token_program = token_program)]
    pub maker_tokens: InterfaceAccount<'info, TokenAccount>,
    #[account(init, payer = maker, associated_token::mint = mint, associated_token::authority = offer, associated_token::token_program = token_program)]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PostBid<'info> {
    #[account(mut)]
    pub maker: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(init, payer = maker, space = 8 + Offer::INIT_SPACE, seeds = [OFFER_SEED, &config.offer_count.to_le_bytes()], bump)]
    pub offer: Account<'info, Offer>,
    pub mint: InterfaceAccount<'info, Mint>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TakeAsk<'info> {
    #[account(mut)]
    pub taker: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [OFFER_SEED, &offer.id.to_le_bytes()], bump = offer.bump, has_one = mint, has_one = maker)]
    pub offer: Account<'info, Offer>,
    /// CHECK: pinned to the offer's maker; only receives lamports.
    #[account(mut)]
    pub maker: UncheckedAccount<'info>,
    /// CHECK: pinned to the config's treasury; only receives lamports.
    #[account(mut, address = config.treasury @ KerbError::BadTreasury)]
    pub treasury: UncheckedAccount<'info>,
    #[account(mint::token_program = token_program)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut, associated_token::mint = mint, associated_token::authority = offer, associated_token::token_program = token_program)]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(init_if_needed, payer = taker, associated_token::mint = mint, associated_token::authority = taker, associated_token::token_program = token_program)]
    pub taker_tokens: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TakeBid<'info> {
    #[account(mut)]
    pub taker: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [OFFER_SEED, &offer.id.to_le_bytes()], bump = offer.bump, has_one = mint, has_one = maker)]
    pub offer: Account<'info, Offer>,
    /// CHECK: pinned to the offer's maker; owns the token account that receives the tokens.
    pub maker: UncheckedAccount<'info>,
    /// CHECK: pinned to the config's treasury; only receives lamports.
    #[account(mut, address = config.treasury @ KerbError::BadTreasury)]
    pub treasury: UncheckedAccount<'info>,
    #[account(mint::token_program = token_program)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut, token::mint = mint, token::authority = taker, token::token_program = token_program)]
    pub taker_tokens: InterfaceAccount<'info, TokenAccount>,
    #[account(init_if_needed, payer = taker, associated_token::mint = mint, associated_token::authority = maker, associated_token::token_program = token_program)]
    pub maker_tokens: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseAsk<'info> {
    /// The maker (cancel), or anyone after expiry (reclaim). Pays for the maker's token account if it is gone.
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(mut, seeds = [OFFER_SEED, &offer.id.to_le_bytes()], bump = offer.bump, has_one = mint, has_one = maker)]
    pub offer: Account<'info, Offer>,
    /// CHECK: pinned to the offer's maker; receives the tokens and the vault's rent.
    #[account(mut)]
    pub maker: UncheckedAccount<'info>,
    #[account(mint::token_program = token_program)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut, associated_token::mint = mint, associated_token::authority = offer, associated_token::token_program = token_program)]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(init_if_needed, payer = signer, associated_token::mint = mint, associated_token::authority = maker, associated_token::token_program = token_program)]
    pub maker_tokens: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseBid<'info> {
    pub signer: Signer<'info>,
    #[account(mut, seeds = [OFFER_SEED, &offer.id.to_le_bytes()], bump = offer.bump, has_one = maker)]
    pub offer: Account<'info, Offer>,
    /// CHECK: pinned to the offer's maker; only receives lamports.
    #[account(mut)]
    pub maker: UncheckedAccount<'info>,
}

/* ================================== events ================================= */

#[event]
pub struct OfferPosted {
    pub id: u64,
    pub maker: Pubkey,
    pub mint: Pubkey,
    pub side: u8,
    pub amount: u64,
    pub total: u64,
    pub min_fill: u64,
    pub taker: Pubkey,
    pub expiry: i64,
}

#[event]
pub struct OfferFilled {
    pub id: u64,
    pub taker: Pubkey,
    pub tokens: u64,
    pub sol: u64,
    pub fee: u64,
    pub remaining: u64,
}

#[event]
pub struct OfferClosed {
    pub id: u64,
    pub cancelled: bool,
    pub refunded_tokens: u64,
    pub refunded_sol: u64,
}

#[event]
pub struct TreasurySet {
    pub treasury: Pubkey,
}

#[error_code]
pub enum KerbError {
    #[msg("Amount and total must be above zero")]
    ZeroAmount,
    #[msg("Smallest fill must be between 1 and the whole amount")]
    BadMinFill,
    #[msg("Expiry must be in the future and within 30 days")]
    BadExpiry,
    #[msg("The token moved by something other than the exact amount")]
    InexactTransfer,
    #[msg("Offer is not open")]
    NotOpen,
    #[msg("Offer has expired")]
    Expired,
    #[msg("Offer has not expired yet")]
    NotExpired,
    #[msg("Only the named taker can fill this offer")]
    NotTaker,
    #[msg("You cannot fill your own offer")]
    SelfFill,
    #[msg("Fill size breaks the offer's terms")]
    BadFill,
    #[msg("Only the admin can do this")]
    NotAdmin,
    #[msg("Wrong treasury account")]
    BadTreasury,
}
