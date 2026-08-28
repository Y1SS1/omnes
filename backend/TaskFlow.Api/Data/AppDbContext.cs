using Microsoft.EntityFrameworkCore;
using TaskFlow.Api.Models;

namespace TaskFlow.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<TaskItem> Tasks => Set<TaskItem>();
    public DbSet<HabitCompletion> HabitCompletions => Set<HabitCompletion>();
    public DbSet<Wallet> Wallets => Set<Wallet>();
    public DbSet<Transaction> Transactions => Set<Transaction>();
    public DbSet<Budget> Budgets => Set<Budget>();
    public DbSet<SavingsMovement> SavingsMovements => Set<SavingsMovement>();
    public DbSet<SavingsPlan> SavingsPlans => Set<SavingsPlan>();
    public DbSet<SavingsGoal> SavingsGoals => Set<SavingsGoal>();
    public DbSet<Notification> Notifications => Set<Notification>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(e =>
        {
            e.HasIndex(u => u.Email).IsUnique();
        });

        modelBuilder.Entity<Wallet>(e =>
        {
            e.HasIndex(w => w.UserId).IsUnique();
            e.HasOne(w => w.User).WithOne(u => u.Wallet)
                .HasForeignKey<Wallet>(w => w.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Category>(e =>
        {
            e.HasOne(c => c.User).WithMany(u => u.Categories)
                .HasForeignKey(c => c.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TaskItem>(e =>
        {
            e.HasOne(t => t.User).WithMany(u => u.Tasks)
                .HasForeignKey(t => t.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(t => t.Category).WithMany()
                .HasForeignKey(t => t.CategoryId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<HabitCompletion>(e =>
        {
            e.HasIndex(h => new { h.TaskItemId, h.Date }).IsUnique();
            e.HasOne(h => h.TaskItem).WithMany(t => t.HabitCompletions)
                .HasForeignKey(h => h.TaskItemId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Transaction>(e =>
        {
            e.Property(t => t.Amount).HasPrecision(14, 2);
            e.HasOne(t => t.User).WithMany(u => u.Transactions)
                .HasForeignKey(t => t.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(t => t.Category).WithMany()
                .HasForeignKey(t => t.CategoryId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Budget>(e =>
        {
            e.Property(b => b.LimitAmount).HasPrecision(14, 2);
            e.HasIndex(b => new { b.UserId, b.Month }).IsUnique();
            e.HasOne(b => b.User).WithMany(u => u.Budgets)
                .HasForeignKey(b => b.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SavingsGoal>(e =>
        {
            e.Property(s => s.TargetAmount).HasPrecision(14, 2);
            e.HasOne(s => s.User).WithMany()
                .HasForeignKey(s => s.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SavingsMovement>(e =>
        {
            e.Property(s => s.Amount).HasPrecision(14, 2);
            e.HasOne(s => s.User).WithMany(u => u.SavingsMovements)
                .HasForeignKey(s => s.UserId).OnDelete(DeleteBehavior.Cascade);
            // Deleting a goal un-labels its movements instead of deleting the money.
            e.HasOne(s => s.SavingsGoal).WithMany(g => g.Movements)
                .HasForeignKey(s => s.SavingsGoalId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<SavingsPlan>(e =>
        {
            e.Property(s => s.PlannedAmount).HasPrecision(14, 2);
            e.HasIndex(s => new { s.UserId, s.Month }).IsUnique();
            e.HasOne(s => s.User).WithMany(u => u.SavingsPlans)
                .HasForeignKey(s => s.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Wallet>().Property(w => w.Balance).HasPrecision(14, 2);
        modelBuilder.Entity<Wallet>().Property(w => w.SavingsFund).HasPrecision(14, 2);

        modelBuilder.Entity<Notification>(e =>
        {
            e.HasOne(n => n.User).WithMany(u => u.Notifications)
                .HasForeignKey(n => n.UserId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}
