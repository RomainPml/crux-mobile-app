-- CreateTable
CREATE TABLE "puzzle_serve" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "puzzle_id" TEXT NOT NULL,
    "served_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "puzzle_serve_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "puzzle_serve_user_id_puzzle_id_key" ON "puzzle_serve"("user_id", "puzzle_id");

-- AddForeignKey
ALTER TABLE "puzzle_serve" ADD CONSTRAINT "puzzle_serve_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puzzle_serve" ADD CONSTRAINT "puzzle_serve_puzzle_id_fkey" FOREIGN KEY ("puzzle_id") REFERENCES "puzzle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
